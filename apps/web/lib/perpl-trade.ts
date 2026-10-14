import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  PERPL_TESTNET,
  type PerplNetwork,
  perplCloseOrder,
  perplCollateralNeeded,
  perplExchangeAbi,
  perplNetwork,
  perplOrderAction,
  perplOrderOutcome,
  perplOrderStep,
  perplWalletOrder,
  perplWalletSteps,
  perplWithdrawStep,
} from "@call-my-bluff/integrations/perpl-exchange";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeFunctionData,
  erc20Abi,
  getAddress,
} from "viem";
import { z } from "zod";
import { identityContext } from "./identity-http";
import { perplClient, perplMainnetEnabled, perplSnapshot } from "./markets";
import { tradingWallet } from "./trading-wallet";

/** Testnet unless the caller names mainnet; mainnet moves real AUSD. */
const chainIdSchema = z
  .union([z.literal(10143), z.literal(143)])
  .default(PERPL_TESTNET.chainId);

export const perpRequestSchema = z
  .object({
    chainId: chainIdSchema,
    marketId: z.number().int().nonnegative(),
    side: z.enum(["long", "short"]),
    // Human decimal size in the market's base asset; converted with market size decimals.
    size: z.string().min(1).max(40),
    leverage: z.number().int().min(1).max(50),
    slippageBps: z.number().int().min(1).max(500),
    // User-supplied attribution; optional, never verified against the post.
    sourcePostId: z
      .string()
      .regex(/^[0-9]{1,30}$/)
      .nullable(),
  })
  .strict();

export const perpConfirmSchema = z
  .object({
    chainId: chainIdSchema,
    transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    requestId: z.string().regex(/^[1-9][0-9]{0,30}$/),
    sourcePostId: z
      .string()
      .regex(/^[0-9]{1,30}$/)
      .nullable(),
  })
  .strict();

/**
 * Order caps per network. Mainnet has its own, lower defaults because it moves
 * real AUSD: leverage, an optional size cap and a cap on collateral per order.
 */
function config(network: PerplNetwork) {
  const mainnet = network.network === "mainnet";
  const fallback = mainnet ? 3 : 5;
  const maxLeverage = Number(
    (mainnet
      ? process.env.PERPL_MAINNET_MAX_LEVERAGE
      : process.env.PERPL_MAX_LEVERAGE) || fallback,
  );
  return {
    maxLeverage:
      Number.isInteger(maxLeverage) && maxLeverage >= 1 && maxLeverage <= 50
        ? maxLeverage
        : fallback,
    // Base-asset size per order; null means no size cap (mainnet relies on the collateral cap).
    maxSize: mainnet
      ? process.env.PERPL_MAINNET_MAX_SIZE || null
      : process.env.PERPL_MAX_SIZE || "1",
    // AUSD one order may lock, as a decimal string; testnet has no cap.
    maxCollateral: mainnet
      ? process.env.PERPL_MAINNET_MAX_COLLATERAL || "50"
      : null,
  };
}

/** Public order caps; the same limits are enforced again on prepare. */
export function perpLimits(network: PerplNetwork = PERPL_TESTNET) {
  return config(network);
}

const execution = (wallet: string, network: PerplNetwork) =>
  `Signed and sent by your wallet ${wallet} to your own Perpl ${network.network} account${network.network === "mainnet" ? " with real AUSD" : ""}. Xtrading never signs or holds keys.`;

type Context = typeof identityContext;

/** The network for a request; mainnet only when the server enables it. */
export function network(chainId: number) {
  let selected: PerplNetwork;
  try {
    selected = perplNetwork(chainId);
  } catch {
    throw new IdentityError("unsupported_chain", 409);
  }
  if (selected.network === "mainnet" && !perplMainnetEnabled())
    throw new IdentityError("perpl_mainnet_disabled", 409);
  return selected;
}

/** The signed-in user's own wallet; every Perpl action is scoped to it. */
async function boundWallet(
  request: Request,
  context: Context,
  selected: PerplNetwork,
) {
  const { user, service, chainId } = await context(request);
  // Testnet stays bound to a testnet deployment; mainnet needs its explicit switch (above).
  if (selected.network === "testnet" && chainId !== PERPL_TESTNET.chainId)
    throw new IdentityError("trading_testnet_only", 409);
  return tradingWallet(request, user, service);
}

/** The wallet's own exchange account, or null when it has not opened one. */
export async function exchangeAccount(
  wallet: `0x${string}`,
  selected: PerplNetwork,
) {
  const client = await perplClient(selected);
  try {
    const account = await client.readContract({
      address: selected.exchange,
      abi: perplExchangeAbi,
      functionName: "getAccountByAddr",
      args: [wallet],
    });
    return {
      id: account.accountId,
      balanceCNS: account.balanceCNS,
      lockedCNS: account.lockedBalanceCNS,
      frozen: account.frozen !== 0,
    };
  } catch (error) {
    const revert =
      error instanceof BaseError &&
      error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (
      revert instanceof ContractFunctionRevertedError &&
      revert.data?.errorName === "AccountDoesNotExist"
    )
      return null;
    throw new IdentityError("perpl_unavailable", 503);
  }
}

async function walletCollateral(wallet: `0x${string}`, selected: PerplNetwork) {
  const client = await perplClient(selected);
  const [balance, allowance] = await Promise.all([
    client.readContract({
      address: selected.collateral,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.readContract({
      address: selected.collateral,
      abi: erc20Abi,
      functionName: "allowance",
      args: [wallet, selected.exchange],
    }),
  ]);
  return { balance, allowance };
}

/**
 * Reviews an order and returns the unsigned transactions the user's own wallet
 * sends: an exact AUSD approval and account funding when needed, then the order.
 * The server never signs; the order trades the wallet's own Perpl account.
 */
export async function preparePerp(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
  context: Context = identityContext,
) {
  const selected = network(input.chainId);
  return preparePerpFor(await boundWallet(request, context, selected), input);
}

/**
 * Reviews an order for a wallet the caller names (the X extension, which reads it
 * from the user's browser wallet). Only unsigned transactions come back; they
 * are useless unless that same wallet signs them, so no session is needed.
 */
export async function preparePerpFor(
  wallet: `0x${string}`,
  input: z.infer<typeof perpRequestSchema>,
) {
  const selected = network(input.chainId);
  const snapshot = await perplSnapshot(selected).catch((error) => {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("perpl_unavailable", 503);
  });
  const market = snapshot.markets.find((m) => m.marketId === input.marketId);
  if (!market) throw new IdentityError("market_unavailable", 409);
  if (!market.open) throw new IdentityError("market_closed", 409);
  // Explicit configuration: never send orders to an exchange Perpl's context names differently.
  if (getAddress(market.exchange) !== getAddress(selected.exchange))
    throw new IdentityError("perpl_exchange_mismatch", 409);
  if (getAddress(market.collateral.address) !== getAddress(selected.collateral))
    throw new IdentityError("perpl_collateral_mismatch", 409);
  const c = config(selected);
  if (input.leverage > c.maxLeverage)
    throw new IdentityError("leverage_above_cap", 409);
  if (market.marketMaxLeverage && input.leverage > market.marketMaxLeverage)
    throw new IdentityError("leverage_above_market_max", 409);
  if (market.maxSlippageBps && input.slippageBps > market.maxSlippageBps)
    throw new IdentityError("slippage_above_market_max", 409);
  if (!market.quote.mark) throw new IdentityError("market_unpriced", 409);
  let lots: bigint, maxLots: bigint;
  try {
    lots = stakeUnits(input.size, market.sizeDecimals);
    maxLots = c.maxSize ? stakeUnits(c.maxSize, market.sizeDecimals) : lots;
  } catch {
    throw new IdentityError("invalid_amount");
  }
  if (lots > maxLots) throw new IdentityError("size_above_cap", 409);
  let order: ReturnType<typeof perplWalletOrder>;
  try {
    order = perplWalletOrder({
      requestId: BigInt(Date.now()),
      perpId: market.marketId,
      side: input.side,
      lots,
      maxLots,
      markPNS: BigInt(market.quote.mark),
      slippageBps: input.slippageBps,
      leverage: input.leverage,
      maxLeverage: Math.min(c.maxLeverage, market.marketMaxLeverage ?? 50),
    });
  } catch {
    throw new IdentityError("invalid_order");
  }
  const [account, funds, minOpen] = await Promise.all([
    exchangeAccount(wallet, selected),
    walletCollateral(wallet, selected),
    perplClient(selected).then((client) =>
      client.readContract({
        address: selected.exchange,
        abi: perplExchangeAbi,
        functionName: "getMinAccountOpenCNS",
      }),
    ),
  ]).catch((error) => {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("perpl_unavailable", 503);
  });
  if (account?.frozen) throw new IdentityError("perpl_account_frozen", 409);
  const needed = perplCollateralNeeded({
    pricePNS: order.pricePNS,
    lots,
    priceDecimals: market.priceDecimals,
    sizeDecimals: market.sizeDecimals,
    leverage: input.leverage,
    takerFeePer100k: market.takerFeePpm ?? 0,
  });
  if (
    c.maxCollateral &&
    needed > stakeUnits(c.maxCollateral, selected.collateralDecimals)
  )
    throw new IdentityError("collateral_above_cap", 409);
  let steps: ReturnType<typeof perplWalletSteps>;
  try {
    steps = perplWalletSteps({
      account,
      walletCollateral: funds.balance,
      allowance: funds.allowance,
      minAccountOpen: minOpen,
      needed,
      order,
      network: selected,
    });
  } catch {
    throw new IdentityError("collateral_insufficient", 409);
  }
  return {
    status: "prepared" as const,
    venue: "Perpl" as const,
    instrument: "perp" as const,
    execution: execution(wallet, selected),
    network: selected.network,
    chainId: selected.chainId,
    wallet,
    market: market.symbol,
    marketId: market.marketId,
    exchange: selected.exchange,
    collateral: market.collateral.symbol,
    collateralDecimals: selected.collateralDecimals,
    side: input.side,
    size: input.size,
    sizeUnits: lots.toString(),
    leverage: input.leverage,
    maxLeverage: c.maxLeverage,
    slippageBps: input.slippageBps,
    limitPrice: order.pricePNS.toString(),
    priceDecimals: market.priceDecimals,
    orderType: "Immediate-or-cancel order, limit at mark ± slippage",
    requestId: order.orderDescId.toString(),
    account: account
      ? {
          id: account.id.toString(),
          balance: account.balanceCNS.toString(),
        }
      : null,
    walletCollateral: funds.balance.toString(),
    collateralNeeded: needed.toString(),
    steps,
    sourcePostId: input.sourcePostId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    observedAt: new Date().toISOString(),
  };
}

/**
 * Reads back a wallet-sent order: the transaction must come from the bound
 * wallet, call execOrder on Perpl's exchange with the reviewed request ID, and
 * succeed. Fills come from the receipt's events, not from an API or a guess.
 */
export async function confirmPerp(
  request: Request,
  input: z.infer<typeof perpConfirmSchema>,
  context: Context = identityContext,
) {
  const selected = network(input.chainId);
  return confirmPerpFor(await boundWallet(request, context, selected), input);
}

/** Read-only check of an order the named wallet sent; nothing is recorded. */
export async function confirmPerpFor(
  wallet: `0x${string}`,
  input: z.infer<typeof perpConfirmSchema>,
) {
  const selected = network(input.chainId);
  const client = await perplClient(selected);
  const hash = input.transactionHash as `0x${string}`;
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }),
  ]).catch(() => {
    throw new IdentityError("transaction_pending", 409);
  });
  if (getAddress(transaction.from) !== wallet)
    throw new IdentityError("transaction_not_from_wallet", 403);
  if (
    !transaction.to ||
    getAddress(transaction.to) !== getAddress(selected.exchange)
  )
    throw new IdentityError("transaction_not_perpl", 409);
  let desc: Extract<
    ReturnType<typeof decodeFunctionData<typeof perplExchangeAbi>>,
    { functionName: "execOrder" }
  >["args"][0];
  try {
    const call = decodeFunctionData({
      abi: perplExchangeAbi,
      data: transaction.input,
    });
    if (call.functionName !== "execOrder") throw new Error();
    desc = call.args[0];
  } catch {
    throw new IdentityError("transaction_not_order", 409);
  }
  if (desc.orderDescId !== BigInt(input.requestId))
    throw new IdentityError("request_mismatch", 409);
  if (receipt.status !== "success")
    return {
      status: "reverted" as const,
      chainId: selected.chainId,
      wallet,
      transactionHash: hash,
      block: Number(receipt.blockNumber),
      message: "The transaction reverted. No order was placed.",
      observedAt: new Date().toISOString(),
    };
  const account = await exchangeAccount(wallet, selected);
  if (!account) throw new IdentityError("perpl_account_missing", 409);
  const outcome = perplOrderOutcome({
    logs: receipt.logs,
    accountId: account.id,
    orderDescId: desc.orderDescId,
    network: selected,
  });
  if (!outcome.found) throw new IdentityError("order_not_found", 409);
  const filled = outcome.filledLots;
  return {
    status:
      filled === 0n
        ? ("not-filled" as const)
        : filled < desc.lotLNS
          ? ("partially-filled" as const)
          : ("filled" as const),
    chainId: selected.chainId,
    wallet,
    accountId: account.id.toString(),
    marketId: Number(desc.perpId),
    action: perplOrderAction[desc.orderType] ?? "open-long",
    requestedSize: desc.lotLNS.toString(),
    filledSize: filled.toString(),
    averagePrice: outcome.averagePricePNS?.toString() ?? null,
    fee: outcome.feeCNS.toString(),
    transactionHash: hash,
    block: Number(receipt.blockNumber),
    sourcePostId: input.sourcePostId,
    message:
      filled === 0n
        ? "Sent from your wallet, but nothing filled within the price bound. No position was opened."
        : "Filled on your own Perpl account. Read from the transaction's events.",
    observedAt: new Date().toISOString(),
  };
}

/** The bound wallet's own Perpl exchange account and wallet AUSD, read from chain. */
export async function perpAccount(
  request: Request,
  chainId: number = PERPL_TESTNET.chainId,
  context: Context = identityContext,
) {
  const selected = network(chainId);
  const wallet = await boundWallet(request, context, selected);
  const [account, funds, snapshot] = await Promise.all([
    exchangeAccount(wallet, selected),
    walletCollateral(wallet, selected),
    perplSnapshot(selected),
  ]).catch((error) => {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("perpl_unavailable", 503);
  });
  const positions = account
    ? (
        await Promise.all(
          snapshot.markets.map(async (market) => ({
            market,
            position: await openPosition(selected, market.marketId, account.id),
          })),
        )
      ).flatMap(({ market, position }) =>
        position
          ? [
              {
                marketId: market.marketId,
                symbol: market.symbol,
                priceDecimals: market.priceDecimals,
                sizeDecimals: market.sizeDecimals,
                side: position.side,
                size: position.lots.toString(),
                entryPrice: position.entryPNS.toString(),
                markPrice: position.markPNS.toString(),
                collateral: position.depositCNS.toString(),
              },
            ]
          : [],
      )
    : [];
  return {
    wallet,
    network: selected.network,
    chainId: selected.chainId,
    exchange: selected.exchange,
    collateralSymbol: "AUSD",
    collateralDecimals: selected.collateralDecimals,
    walletCollateral: funds.balance.toString(),
    account: account
      ? {
          id: account.id.toString(),
          available: account.balanceCNS.toString(),
          locked: account.lockedCNS.toString(),
          frozen: account.frozen,
        }
      : null,
    positions,
    source: `Perpl Exchange contract on Monad ${selected.network}`,
    observedAt: new Date().toISOString(),
  };
}

/** The account's open position on one market, read from the Exchange contract. */
export async function openPosition(
  selected: PerplNetwork,
  perpId: number,
  accountId: bigint,
) {
  const client = await perplClient(selected);
  const [position, markPNS] = await client.readContract({
    address: selected.exchange,
    abi: perplExchangeAbi,
    functionName: "getPosition",
    args: [BigInt(perpId), accountId],
  });
  if (position.accountId !== accountId || position.lotLNS === 0n) return null;
  return {
    // Perpl position types: 0 long, 1 short.
    side: position.positionType === 0 ? ("long" as const) : ("short" as const),
    lots: position.lotLNS,
    entryPNS: position.pricePNS,
    depositCNS: position.depositCNS,
    markPNS,
  };
}

export const closeRequestSchema = z
  .object({
    chainId: chainIdSchema,
    marketId: z.number().int().nonnegative(),
    slippageBps: z.number().int().min(1).max(500),
  })
  .strict();

/**
 * A full close of the wallet's own position, as one unsigned execOrder step.
 * Size and side come from the chain, not the browser; the order is reduce-only.
 */
export async function preparePerpClose(
  request: Request,
  input: z.infer<typeof closeRequestSchema>,
  context: Context = identityContext,
) {
  const selected = network(input.chainId);
  const wallet = await boundWallet(request, context, selected);
  const [account, snapshot] = await Promise.all([
    exchangeAccount(wallet, selected),
    perplSnapshot(selected),
  ]).catch((error) => {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("perpl_unavailable", 503);
  });
  if (!account) throw new IdentityError("perpl_account_missing", 409);
  if (account.frozen) throw new IdentityError("perpl_account_frozen", 409);
  const market = snapshot.markets.find((m) => m.marketId === input.marketId);
  if (!market?.open) throw new IdentityError("market_closed", 409);
  if (market.maxSlippageBps && input.slippageBps > market.maxSlippageBps)
    throw new IdentityError("slippage_above_market_max", 409);
  const position = await openPosition(
    selected,
    market.marketId,
    account.id,
  ).catch(() => {
    throw new IdentityError("perpl_unavailable", 503);
  });
  if (!position) throw new IdentityError("position_not_open", 409);
  const order = perplCloseOrder({
    requestId: BigInt(Date.now()),
    perpId: market.marketId,
    position: position.side,
    lots: position.lots,
    markPNS: position.markPNS,
    slippageBps: input.slippageBps,
  });
  return {
    network: selected.network,
    chainId: selected.chainId,
    wallet,
    accountId: account.id.toString(),
    market: market.symbol,
    marketId: market.marketId,
    side: position.side,
    size: position.lots.toString(),
    sizeDecimals: market.sizeDecimals,
    priceDecimals: market.priceDecimals,
    collateral: position.depositCNS.toString(),
    limitPrice: order.pricePNS.toString(),
    slippageBps: input.slippageBps,
    requestId: order.orderDescId.toString(),
    steps: [
      perplOrderStep(
        order,
        `Close your ${market.symbol} ${position.side} from your wallet`,
        selected,
      ),
    ],
    note: "Reduce-only, immediate-or-cancel; it may fill partially. Freed margin stays in your Perpl account until you withdraw it.",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

export const withdrawRequestSchema = z
  .object({
    chainId: chainIdSchema,
    amount: z.string().regex(/^[0-9]{1,12}(\.[0-9]{1,6})?$/),
  })
  .strict();

/** Withdraws free AUSD from the wallet's own Perpl account back to that wallet. */
export async function preparePerpWithdraw(
  request: Request,
  input: z.infer<typeof withdrawRequestSchema>,
  context: Context = identityContext,
) {
  const selected = network(input.chainId);
  const wallet = await boundWallet(request, context, selected);
  const account = await exchangeAccount(wallet, selected);
  if (!account) throw new IdentityError("perpl_account_missing", 409);
  if (account.frozen) throw new IdentityError("perpl_account_frozen", 409);
  let amount: bigint;
  try {
    amount = stakeUnits(input.amount, selected.collateralDecimals);
  } catch {
    throw new IdentityError("invalid_amount");
  }
  let step: ReturnType<typeof perplWithdrawStep>;
  try {
    step = perplWithdrawStep(amount, account.balanceCNS, selected);
  } catch {
    throw new IdentityError("amount_above_available", 409);
  }
  return {
    network: selected.network,
    chainId: selected.chainId,
    wallet,
    accountId: account.id.toString(),
    amount: amount.toString(),
    available: account.balanceCNS.toString(),
    steps: [step],
  };
}
