import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  creatorFeeStep,
  flowAbi,
  flowEntrypoint,
  flowRouter,
} from "@call-my-bluff/integrations/creator-fees";
import {
  accountCoreAbi,
  bookEstimate,
  kuruMainnet,
  kuruUsdc,
  kuruV1OrderBookAbi,
  kuruV2,
  mainnetOrderSize,
  mainnetTopOfBookEstimate,
  mainnetTradeStep,
  minimumQuotedOutput,
  networkTradeTokens,
  nextTradeStep,
  orderBookAbi,
  tradeTokens,
  withdrawStep,
} from "@call-my-bluff/integrations/kuru";
import {
  kuruAccountSchema,
  prepareSpotSchema,
  prepareWithdrawSchema,
  spotReviewSchema,
  withdrawReviewSchema,
} from "@call-my-bluff/integrations/market-schemas";
import {
  type Address,
  decodeFunctionResult,
  erc20Abi,
  getAddress,
  type Hex,
  zeroAddress,
} from "viem";
import { resolveCreatorFee } from "./creator-payouts";
import { identityContext } from "./identity-http";
import {
  kuruMainnetSnapshot,
  kuruMarketSnapshot,
  mainnetClient,
  testnetClient,
} from "./markets";

const REVIEW_SECONDS = 30;
// Onchain swap deadline; covers wallet review after the app-side expiry.
const DEADLINE_SECONDS = 120n;

// The trading chain is explicit per request; each client enforces its own chain.
async function boundWallet(request: Request) {
  const { user, service } = await identityContext(request);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some(
      (wallet) => wallet.toLowerCase() === binding.wallet.toLowerCase(),
    )
  )
    throw new IdentityError("current_binding_required", 403);
  return getAddress(binding.wallet);
}

type Client =
  | ReturnType<typeof testnetClient>
  | ReturnType<typeof mainnetClient>;
async function finishStep(
  client: Client,
  chainId: 10143 | 143,
  wallet: Address,
  step: { to: Address; data: Hex; value: bigint },
  block: { number: bigint; hash: Hex | null },
  nativeBalance: bigint,
) {
  let gas: bigint;
  try {
    gas = await (client as ReturnType<typeof testnetClient>).estimateGas({
      account: wallet,
      ...step,
    });
  } catch {
    throw new IdentityError("trade_simulation_failed", 409);
  }
  const gasPrice = await client.getGasPrice();
  if (nativeBalance < step.value + ((gas * 120n) / 100n) * gasPrice)
    throw new IdentityError("insufficient_gas_balance", 409);
  if (
    (await client.getBlock({ blockNumber: block.number })).hash !== block.hash
  )
    throw new IdentityError("snapshot_reorg", 503);
  return {
    status: "prepared" as const,
    venue: "Kuru" as const,
    chainId,
    wallet,
    to: step.to,
    data: step.data,
    value: step.value.toString(),
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
    nativeBalance: nativeBalance.toString(),
    expiresAt: new Date(Date.now() + REVIEW_SECONDS * 1000).toISOString(),
    observedAt: new Date().toISOString(),
    blockNumber: block.number.toString(),
  };
}

export async function prepareSpot(request: Request, body: unknown) {
  const parsed = prepareSpotSchema.safeParse(body);
  if (!parsed.success) throw new IdentityError("invalid_trade_intent");
  const input = parsed.data;
  const wallet = await boundWallet(request);
  if (input.creatorXUserId) {
    if (input.chainId !== 143 || input.side !== "buy" || !input.sourcePostId)
      throw new IdentityError("creator_fee_mainnet_buy_required", 409);
    return prepareCreatorSpot(wallet, input);
  }
  if (input.chainId === 143) return prepareMainnetSpot(wallet, input);
  const { client, block, book, takerFeePps } = await kuruMarketSnapshot(
    input.market,
  );
  const at = { blockNumber: block.number };
  const tokens = tradeTokens(input.market, input.side);
  const nativeInput = tokens.input.address === zeroAddress;
  const [rootAccountId, tokenBalance, allowance, nativeBalance] =
    await Promise.all([
      client.readContract({
        address: kuruV2.accountCore,
        abi: accountCoreAbi,
        functionName: "rootAccountIdOf",
        args: [wallet],
        ...at,
      }),
      nativeInput
        ? 0n
        : client.readContract({
            address: tokens.input.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [wallet],
            ...at,
          }),
      nativeInput
        ? 0n
        : client.readContract({
            address: tokens.input.address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [wallet, kuruV2.accountCore],
            ...at,
          }),
      client.getBalance({ address: wallet, ...at }),
    ]);
  const walletBalance = nativeInput ? nativeBalance : tokenBalance;
  const accountBalance =
    rootAccountId > 0
      ? await client.readContract({
          address: kuruV2.accountCore,
          abi: accountCoreAbi,
          functionName: "getBalance",
          args: [rootAccountId, tokens.input.address],
          ...at,
        })
      : 0n;
  const amount = BigInt(input.amount);
  if (amount > accountBalance + walletBalance)
    throw new IdentityError("insufficient_market_token", 409);
  const estimate = bookEstimate({
    key: input.market,
    side: input.side,
    amountIn: amount,
    book,
    takerFeePps,
  });
  const deadline =
    BigInt(Math.floor(Date.now() / 1000)) +
    BigInt(REVIEW_SECONDS) +
    DEADLINE_SECONDS;
  const stepInput = {
    key: input.market,
    side: input.side,
    amount,
    wallet,
    rootAccountId: BigInt(rootAccountId),
    accountBalance,
    walletBalance,
    allowance,
    minimumOutput: 1n,
    deadline,
  };
  let step: ReturnType<typeof nextTradeStep>;
  try {
    step = nextTradeStep(stepInput);
  } catch {
    throw new IdentityError("invalid_market_amount", 409);
  }
  let amountInUsed: bigint | null = null,
    expectedOutput: bigint | null = null,
    minimumOutput: bigint | null = null;
  if (step.action === "swap") {
    // Execute the actual swap with eth_call at the pinned block; no state overrides.
    try {
      const result = await client.call({
        account: wallet,
        to: step.to,
        data: step.data,
        ...at,
      });
      const decoded = decodeFunctionResult({
        abi: orderBookAbi,
        functionName: "swap",
        data: result.data as Hex,
      });
      amountInUsed = decoded.amountInUsed;
      expectedOutput = decoded.amountOut;
      minimumOutput = minimumQuotedOutput(expectedOutput, input.slippageBps);
      step = nextTradeStep({ ...stepInput, minimumOutput });
    } catch {
      throw new IdentityError(
        "quote_unavailable_or_insufficient_liquidity",
        409,
      );
    }
  }
  return spotReviewSchema.parse({
    ...(await finishStep(client, 10143, wallet, step, block, nativeBalance)),
    instrument: "spot",
    market: input.market,
    side: input.side,
    action: step.action,
    amount: input.amount,
    input: tokens.input,
    output: tokens.output,
    walletBalance: walletBalance.toString(),
    accountBalance: accountBalance.toString(),
    indicativeOutput: estimate.output > 0n ? estimate.output.toString() : null,
    indicativeFilled: estimate.filled,
    amountInUsed: amountInUsed?.toString() ?? null,
    expectedOutput: expectedOutput?.toString() ?? null,
    minimumOutput: minimumOutput?.toString() ?? null,
    deadline: step.action === "swap" ? deadline.toString() : null,
    takerFeePps: takerFeePps.toString(),
    sourcePostId: input.sourcePostId,
    slippageBps: input.slippageBps,
  });
}

type SpotIntent = ReturnType<typeof prepareSpotSchema.parse>;
/**
 * Kuru mainnet: the market order spends wallet funds directly. The order is
 * executed with eth_call at the pinned block to derive the minimum output.
 */
async function prepareMainnetSpot(wallet: Address, input: SpotIntent) {
  const { client, block, takerFeeBps, bid, ask } = await kuruMainnetSnapshot(
    input.market,
  );
  const at = { blockNumber: block.number };
  const market = kuruMainnet.markets[input.market];
  const tokens = networkTradeTokens(143, input.market, input.side);
  const native = tokens.input.address === zeroAddress;
  const [nativeBalance, tokenBalance, allowance] = await Promise.all([
    client.getBalance({ address: wallet, ...at }),
    native
      ? 0n
      : client.readContract({
          address: tokens.input.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet],
          ...at,
        }),
    native
      ? 0n
      : client.readContract({
          address: tokens.input.address,
          abi: erc20Abi,
          functionName: "allowance",
          args: [wallet, market.market],
          ...at,
        }),
  ]);
  const walletBalance = native ? nativeBalance : tokenBalance;
  let spend: bigint;
  try {
    spend = mainnetOrderSize({
      key: input.market,
      side: input.side,
      amount: BigInt(input.amount),
    }).spend;
  } catch {
    throw new IdentityError("invalid_market_amount", 409);
  }
  if (spend > walletBalance)
    throw new IdentityError("insufficient_market_token", 409);
  const stepInput = {
    key: input.market,
    side: input.side,
    amount: BigInt(input.amount),
    walletBalance,
    allowance,
    minimumOutput: 1n,
  };
  let step = mainnetTradeStep(stepInput);
  let expectedOutput: bigint | null = null,
    minimumOutput: bigint | null = null;
  if (step.action === "swap") {
    try {
      const result = await client.call({
        account: wallet,
        to: step.to,
        data: step.data,
        value: step.value,
        ...at,
      });
      expectedOutput = decodeFunctionResult({
        abi: kuruV1OrderBookAbi,
        functionName:
          input.side === "buy"
            ? "placeAndExecuteMarketBuy"
            : "placeAndExecuteMarketSell",
        data: result.data as Hex,
      });
      minimumOutput = minimumQuotedOutput(expectedOutput, input.slippageBps);
      step = mainnetTradeStep({ ...stepInput, minimumOutput });
    } catch {
      throw new IdentityError(
        "quote_unavailable_or_insufficient_liquidity",
        409,
      );
    }
  }
  const indicative = mainnetTopOfBookEstimate({
    key: input.market,
    side: input.side,
    spend,
    bid,
    ask,
    takerFeeBps,
  });
  return spotReviewSchema.parse({
    ...(await finishStep(client, 143, wallet, step, block, nativeBalance)),
    instrument: "spot",
    market: input.market,
    side: input.side,
    action: step.action,
    amount: input.amount,
    input: tokens.input,
    output: tokens.output,
    walletBalance: walletBalance.toString(),
    accountBalance: "0",
    indicativeOutput: indicative > 0n ? indicative.toString() : null,
    indicativeFilled: true,
    amountInUsed: spend.toString(),
    expectedOutput: expectedOutput?.toString() ?? null,
    minimumOutput: minimumOutput?.toString() ?? null,
    // Kuru mainnet market orders have no onchain deadline.
    deadline: null,
    // Pips (1e-7) to match the testnet review; mainnet fees are in bps.
    takerFeePps: (takerFeeBps * 1000n).toString(),
    sourcePostId: input.sourcePostId,
    slippageBps: input.slippageBps,
  });
}

/** Build a single configured Kuru route locally; never forward opaque provider calldata. */
async function prepareCreatorSpot(wallet: Address, input: SpotIntent) {
  if (!input.creatorXUserId)
    throw new IdentityError("creator_payout_unavailable", 409);
  const fee = await resolveCreatorFee(input.creatorXUserId, wallet);
  const { client, block, takerFeeBps } = await kuruMainnetSnapshot(
    input.market,
  );
  const at = { blockNumber: block.number };
  const tokens = networkTradeTokens(143, input.market, "buy");
  const amount = BigInt(input.amount);
  // No unused input dust is donated to the router through market precision rounding.
  if (
    mainnetOrderSize({ key: input.market, side: "buy", amount }).spend !==
    amount
  )
    throw new IdentityError("invalid_market_amount", 409);
  const [router, code, walletBalance, allowance, nativeBalance] =
    await Promise.all([
      client.readContract({
        address: flowEntrypoint,
        abi: flowAbi,
        functionName: "getRouter",
        ...at,
      }),
      client.getCode({ address: flowEntrypoint, ...at }),
      client.readContract({
        address: tokens.input.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
        ...at,
      }),
      client.readContract({
        address: tokens.input.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [wallet, flowEntrypoint],
        ...at,
      }),
      client.getBalance({ address: wallet, ...at }),
    ]);
  if (
    !code ||
    code === "0x" ||
    router.toLowerCase() !== flowRouter.toLowerCase()
  )
    throw new IdentityError("fee_router_verification_failed", 503);
  if (walletBalance < amount)
    throw new IdentityError("insufficient_market_token", 409);
  let expectedOutput: bigint | null = null,
    minimumOutput: bigint | null = null;
  let step = creatorFeeStep({
    market: input.market,
    amount,
    minimumOutput: 1n,
    allowance,
    recipient: fee.wallet,
  });
  if (step.action === "swap") {
    try {
      const result = await client.call({
        account: wallet,
        to: step.to,
        data: step.data,
        ...at,
      });
      expectedOutput = decodeFunctionResult({
        abi: flowAbi,
        functionName: "executeSwap",
        data: result.data as Hex,
      });
      minimumOutput = minimumQuotedOutput(expectedOutput, input.slippageBps);
      step = creatorFeeStep({
        market: input.market,
        amount,
        minimumOutput,
        allowance,
        recipient: fee.wallet,
      });
    } catch {
      throw new IdentityError(
        "quote_unavailable_or_insufficient_liquidity",
        409,
      );
    }
  }
  return spotReviewSchema.parse({
    ...(await finishStep(client, 143, wallet, step, block, nativeBalance)),
    instrument: "spot",
    market: input.market,
    side: "buy",
    action: step.action,
    amount: input.amount,
    input: tokens.input,
    output: tokens.output,
    walletBalance: walletBalance.toString(),
    accountBalance: "0",
    indicativeOutput: null,
    indicativeFilled: false,
    amountInUsed: step.action === "swap" ? input.amount : null,
    expectedOutput: expectedOutput?.toString() ?? null,
    minimumOutput: minimumOutput?.toString() ?? null,
    deadline: null,
    takerFeePps: (takerFeeBps * 1000n).toString(),
    sourcePostId: input.sourcePostId,
    slippageBps: input.slippageBps,
    execution: "creator-flow",
    creatorFee: { ...fee, denomination: tokens.output },
  });
}

/** Mainnet has no Kuru custody account: wallet balances only. */
async function mainnetAccount(wallet: Address) {
  const client = mainnetClient();
  if ((await client.getChainId()) !== 143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const block = await client.getBlock();
  const at = { blockNumber: block.number };
  const nativeBalance = await client.getBalance({ address: wallet, ...at });
  const tokens = [
    kuruMainnet.markets.MON.base,
    kuruMainnet.quote,
    kuruMainnet.markets.WETH.base,
    kuruMainnet.markets.WBTC.base,
  ];
  const balances = await Promise.all(
    tokens.map(async (token) => ({
      token,
      account: "0",
      wallet: (token.address === zeroAddress
        ? nativeBalance
        : await client.readContract({
            address: token.address,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [wallet],
            ...at,
          })
      ).toString(),
    })),
  );
  return kuruAccountSchema.parse({
    chainId: 143,
    wallet,
    rootAccountId: "0",
    balances,
    nativeBalance: nativeBalance.toString(),
    observedAt: new Date().toISOString(),
    blockNumber: block.number.toString(),
  });
}

const accountTokens = [
  kuruV2.markets.MON.base,
  kuruUsdc,
  kuruV2.markets.WETH.base,
  kuruV2.markets.WBTC.base,
];

export async function kuruAccount(request: Request, chainId: 10143 | 143) {
  const wallet = await boundWallet(request);
  if (chainId === 143) return mainnetAccount(wallet);
  const client = testnetClient();
  if ((await client.getChainId()) !== 10143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const block = await client.getBlock();
  const at = { blockNumber: block.number };
  const [rootAccountId, nativeBalance] = await Promise.all([
    client.readContract({
      address: kuruV2.accountCore,
      abi: accountCoreAbi,
      functionName: "rootAccountIdOf",
      args: [wallet],
      ...at,
    }),
    client.getBalance({ address: wallet, ...at }),
  ]);
  const balances = await Promise.all(
    accountTokens.map(async (token) => {
      const [account, held] = await Promise.all([
        rootAccountId > 0
          ? client.readContract({
              address: kuruV2.accountCore,
              abi: accountCoreAbi,
              functionName: "getBalance",
              args: [rootAccountId, token.address],
              ...at,
            })
          : 0n,
        token.address === zeroAddress
          ? nativeBalance
          : client.readContract({
              address: token.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [wallet],
              ...at,
            }),
      ]);
      return {
        token,
        account: account.toString(),
        wallet: held.toString(),
      };
    }),
  );
  return kuruAccountSchema.parse({
    chainId: 10143,
    wallet,
    rootAccountId: rootAccountId.toString(),
    balances,
    nativeBalance: nativeBalance.toString(),
    observedAt: new Date().toISOString(),
    blockNumber: block.number.toString(),
  });
}

export async function prepareWithdraw(request: Request, body: unknown) {
  const parsed = prepareWithdrawSchema.safeParse(body);
  if (!parsed.success) throw new IdentityError("invalid_withdrawal");
  const wallet = await boundWallet(request);
  const token =
    parsed.data.token === "USDC"
      ? kuruUsdc
      : kuruV2.markets[parsed.data.token].base;
  const client = testnetClient();
  if ((await client.getChainId()) !== 10143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const block = await client.getBlock();
  const at = { blockNumber: block.number };
  const [rootAccountId, nativeBalance] = await Promise.all([
    client.readContract({
      address: kuruV2.accountCore,
      abi: accountCoreAbi,
      functionName: "rootAccountIdOf",
      args: [wallet],
      ...at,
    }),
    client.getBalance({ address: wallet, ...at }),
  ]);
  const available =
    rootAccountId > 0
      ? await client.readContract({
          address: kuruV2.accountCore,
          abi: accountCoreAbi,
          functionName: "getBalance",
          args: [rootAccountId, token.address],
          ...at,
        })
      : 0n;
  const amount = BigInt(parsed.data.amount);
  if (amount > available) throw new IdentityError("insufficient_balance", 409);
  const step = withdrawStep({
    rootAccountId: BigInt(rootAccountId),
    token: token.address,
    amount,
    wallet,
  });
  return withdrawReviewSchema.parse({
    ...(await finishStep(client, 10143, wallet, step, block, nativeBalance)),
    action: "withdraw",
    token,
    amount: parsed.data.amount,
  });
}
