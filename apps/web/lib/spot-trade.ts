import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  accountCoreAbi,
  bookEstimate,
  kuruUsdc,
  kuruV2,
  minimumQuotedOutput,
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
import { identityContext } from "./identity-http";
import { kuruMarketSnapshot, testnetClient } from "./markets";

const REVIEW_SECONDS = 30;
// Onchain swap deadline; covers wallet review after the app-side expiry.
const DEADLINE_SECONDS = 120n;

async function boundWallet(request: Request) {
  const { user, service, chainId } = await identityContext(request);
  if (chainId !== 10143) throw new IdentityError("trading_testnet_only", 409);
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

type Client = ReturnType<typeof testnetClient>;
async function finishStep(
  client: Client,
  wallet: Address,
  step: { to: Address; data: Hex; value: bigint },
  block: { number: bigint; hash: Hex | null },
  nativeBalance: bigint,
) {
  let gas: bigint;
  try {
    gas = await client.estimateGas({ account: wallet, ...step });
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
    chainId: 10143 as const,
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
    ...(await finishStep(client, wallet, step, block, nativeBalance)),
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

const accountTokens = [
  kuruV2.markets.MON.base,
  kuruUsdc,
  kuruV2.markets.WETH.base,
  kuruV2.markets.WBTC.base,
];

export async function kuruAccount(request: Request) {
  const wallet = await boundWallet(request);
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
    ...(await finishStep(client, wallet, step, block, nativeBalance)),
    action: "withdraw",
    token,
    amount: parsed.data.amount,
  });
}
