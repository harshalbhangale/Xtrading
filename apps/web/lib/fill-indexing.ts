import "server-only";
import { tradeIntents } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  type KuruActivity,
  kuruActivitySchema,
  mainnetTradesSchema,
  recordTradeSchema,
} from "@call-my-bluff/domain";
import {
  decodeMainnetMarketOrder,
  type KuruMarketKey,
  kuruUsdc,
  kuruV2,
  orderBookAbi,
} from "@call-my-bluff/integrations/kuru";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  type Address,
  decodeEventLog,
  getAddress,
  type Hex,
  type Transaction,
  type TransactionReceipt,
} from "viem";
import { getDatabase } from "./database";
import { envioQuery } from "./envio";
import { identityContext } from "./identity-http";
import { mainnetClient, mainnetEnabled, testnetClient } from "./markets";

const marketKeys = new Map<string, KuruMarketKey>(
  (Object.keys(kuruV2.markets) as KuruMarketKey[]).map((key) => [
    kuruV2.markets[key].market.toLowerCase(),
    key,
  ]),
);
const tokenSymbols = new Map<string, "USDC" | "WETH" | "WBTC" | "MON">([
  [kuruUsdc.address.toLowerCase(), "USDC"],
  [kuruV2.markets.WETH.base.address.toLowerCase(), "WETH"],
  [kuruV2.markets.WBTC.base.address.toLowerCase(), "WBTC"],
  [kuruV2.markets.MON.base.address.toLowerCase(), "MON"],
]);

async function boundWallet(request: Request) {
  const { user, service } = await identityContext(request);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("current_binding_required", 403);
  return { wallet: getAddress(binding.wallet), privyUserId: user.privyUserId };
}

type Row = Record<string, unknown>;
async function hasura(query: string, variables: Record<string, unknown>) {
  const result = await envioQuery(query, variables);
  return !result || result.errors || !result.data
    ? null
    : (result.data as Record<string, Row[]>);
}

/** Confirmed Kuru V2 swaps and custody movements for one wallet's accounts. */
export async function walletActivity(wallet: Address): Promise<KuruActivity> {
  const observedAt = new Date().toISOString();
  const unavailable: KuruActivity = {
    status: "unavailable",
    observedAt,
    progressBlock: null,
    headBlock: null,
    accountIds: [],
    swaps: [],
    transfers: [],
  };
  try {
    const [head, accounts] = await Promise.all([
      testnetClient().getBlockNumber(),
      hasura(
        `query Accounts($owner: String!) {
          _meta(where: {chainId: {_eq: 10143}}) {progressBlock progressBlockTime isReady}
          KuruAccount(where: {chainId: {_eq: 10143}, rootOwner: {_eq: $owner}}, limit: 20) {accountId}
        }`,
        { owner: wallet.toLowerCase() },
      ),
    ]);
    const meta = accounts?._meta?.[0];
    if (!accounts || !meta || !Array.isArray(accounts.KuruAccount))
      return unavailable;
    const progress = BigInt(String(meta.progressBlock));
    const accountIds = accounts.KuruAccount.map((a) => String(a.accountId));
    let swaps: Row[] = [],
      transfers: Row[] = [];
    if (accountIds.length > 0) {
      const rows = await hasura(
        `query Activity($ids: [numeric!]!, $markets: [String!]!) {
          KuruSwap(where: {chainId: {_eq: 10143}, accountId: {_in: $ids}, market: {_in: $markets}}, order_by: [{blockNumber: desc}, {id: desc}], limit: 50) {
            id market isBuy amountIn amountOut minAmountOut blockNumber timestamp transactionHash
          }
          KuruTransfer(where: {chainId: {_eq: 10143}, accountId: {_in: $ids}}, order_by: [{blockNumber: desc}, {id: desc}], limit: 50) {
            id kind token amount blockNumber timestamp transactionHash
          }
        }`,
        { ids: accountIds, markets: [...marketKeys.keys()] },
      );
      if (!rows) return unavailable;
      swaps = rows.KuruSwap ?? [];
      transfers = (rows.KuruTransfer ?? []).filter((t) =>
        tokenSymbols.has(String(t.token)),
      );
    }
    // Attach user-supplied source posts recorded for these transactions.
    const sources = new Map<string, string>();
    const database = getDatabase();
    const hashes = swaps.map((s) => String(s.transactionHash).toLowerCase());
    if (database && hashes.length > 0) {
      const intents = await database.db
        .select({
          hash: tradeIntents.transactionHash,
          post: tradeIntents.sourcePostId,
        })
        .from(tradeIntents)
        .where(
          and(
            eq(tradeIntents.chainId, 10143),
            inArray(tradeIntents.transactionHash, hashes),
          ),
        );
      for (const intent of intents)
        if (intent.hash) sources.set(intent.hash, intent.post);
    }
    const age = Date.now() - Date.parse(String(meta.progressBlockTime));
    return kuruActivitySchema.parse({
      // Readiness and head proximity are freshness checks, not finality.
      status:
        meta.isReady === true &&
        progress <= head &&
        head - progress <= 50n &&
        Number.isFinite(age) &&
        age <= 120_000
          ? "current"
          : "lagging",
      observedAt,
      progressBlock: progress.toString(),
      headBlock: head.toString(),
      accountIds,
      swaps: swaps.map((s) => ({
        id: s.id,
        market: marketKeys.get(String(s.market)),
        side: s.isBuy ? "buy" : "sell",
        amountIn: String(s.amountIn),
        amountOut: String(s.amountOut),
        minAmountOut: String(s.minAmountOut),
        blockNumber: String(s.blockNumber),
        timestamp: String(s.timestamp),
        transactionHash: s.transactionHash,
        sourcePostId:
          sources.get(String(s.transactionHash).toLowerCase()) ?? null,
      })),
      transfers: transfers.map((t) => ({
        id: t.id,
        kind: t.kind,
        token: tokenSymbols.get(String(t.token)),
        amount: String(t.amount),
        blockNumber: String(t.blockNumber),
        timestamp: String(t.timestamp),
        transactionHash: t.transactionHash,
      })),
    });
  } catch {
    return unavailable;
  }
}

export async function myActivity(request: Request) {
  const { wallet } = await boundWallet(request);
  return walletActivity(wallet);
}

type SwapFacts = {
  marketAddress: string;
  side: "buy" | "sell";
  inputAmount: bigint;
};

/** Testnet fills emit a SpotSwap summary from the order book the transaction called. */
function testnetSwap(
  transaction: Transaction,
  receipt: TransactionReceipt,
): SwapFacts | null {
  const market = transaction.to
    ? marketKeys.get(transaction.to.toLowerCase())
    : undefined;
  if (!market) return null;
  const marketAddress = kuruV2.markets[market].market.toLowerCase();
  let swap: { isBuy: boolean; amountInUsed: bigint } | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== marketAddress) continue;
    try {
      swap = decodeEventLog({
        abi: orderBookAbi,
        eventName: "SpotSwap",
        data: log.data,
        topics: log.topics,
      }).args;
    } catch {
      // Other market logs (trade tape, book updates) are not swap summaries.
    }
  }
  return swap
    ? {
        marketAddress,
        side: swap.isBuy ? "buy" : "sell",
        inputAmount: swap.amountInUsed,
      }
    : null;
}

/** Mainnet has no SpotSwap summary here; the order is read from the calldata that was sent. */
function mainnetSwap(transaction: Transaction): SwapFacts | null {
  const order = decodeMainnetMarketOrder({
    to: transaction.to,
    data: transaction.input,
  });
  return order
    ? {
        marketAddress: order.marketAddress,
        side: order.side,
        inputAmount: order.inputAmount,
      }
    : null;
}

/**
 * Links a confirmed trade to the post that prompted it. The receipt must show a
 * successful transaction from the bound wallet to a configured market on the same
 * chain. The post ID itself remains user-supplied.
 */
export async function recordTrade(request: Request, body: unknown) {
  const parsed = recordTradeSchema.safeParse(body);
  if (!parsed.success) throw new IdentityError("invalid_trade_record");
  const { wallet, privyUserId } = await boundWallet(request);
  const { chainId, sourcePostId } = parsed.data;
  const hash = parsed.data.transactionHash.toLowerCase() as Hex;
  const client = chainId === 143 ? mainnetClient() : testnetClient();
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }),
  ]).catch(() => {
    throw new IdentityError("transaction_unavailable", 409);
  });
  if (
    receipt.status !== "success" ||
    transaction.from.toLowerCase() !== wallet.toLowerCase()
  )
    throw new IdentityError("not_a_confirmed_swap", 409);
  const swap =
    chainId === 143
      ? mainnetSwap(transaction)
      : testnetSwap(transaction, receipt);
  if (!swap) throw new IdentityError("not_a_confirmed_swap", 409);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const [existing] = await database.db
    .select({ id: tradeIntents.id })
    .from(tradeIntents)
    .where(eq(tradeIntents.transactionHash, hash))
    .limit(1);
  if (existing) return { recorded: false, reason: "already_recorded" };
  await database.db.insert(tradeIntents).values({
    privyUserId,
    chainId,
    market: swap.marketAddress,
    side: swap.side,
    amount: swap.inputAmount.toString(),
    sourcePostId,
    transactionHash: hash,
  });
  return { recorded: true, chainId };
}

/**
 * Mainnet trades this wallet recorded, each checked again against its receipt.
 * There is no mainnet indexer, so a trade that no longer verifies shows as unverified.
 */
export async function mainnetTrades(request: Request) {
  const { wallet, privyUserId } = await boundWallet(request);
  const observedAt = new Date().toISOString();
  const unavailable = (reason: string) =>
    mainnetTradesSchema.parse({
      status: "unavailable",
      observedAt,
      reason,
      trades: [],
    });
  if (!mainnetEnabled()) return unavailable("mainnet_trading_disabled");
  const database = getDatabase();
  if (!database) return unavailable("database_unavailable");
  const intents = await database.db
    .select({
      hash: tradeIntents.transactionHash,
      post: tradeIntents.sourcePostId,
      recordedAt: tradeIntents.createdAt,
    })
    .from(tradeIntents)
    .where(
      and(
        eq(tradeIntents.privyUserId, privyUserId),
        eq(tradeIntents.chainId, 143),
      ),
    )
    .orderBy(desc(tradeIntents.createdAt))
    .limit(10);
  const client = mainnetClient();
  const trades = await Promise.all(
    intents.map(async (intent) => {
      const base = {
        transactionHash: intent.hash ?? "",
        sourcePostId: intent.post,
        recordedAt: intent.recordedAt.toISOString(),
      };
      const unverified = {
        ...base,
        verified: false,
        market: null,
        side: null,
        inputAmount: null,
        minAmountOut: null,
        blockNumber: null,
      };
      if (!intent.hash) return unverified;
      const hash = intent.hash.toLowerCase() as Hex;
      const [transaction, receipt] = await Promise.all([
        client.getTransaction({ hash }),
        client.getTransactionReceipt({ hash }),
      ]).catch(() => [null, null] as const);
      if (
        !transaction ||
        !receipt ||
        receipt.status !== "success" ||
        transaction.from.toLowerCase() !== wallet.toLowerCase()
      )
        return unverified;
      const order = decodeMainnetMarketOrder({
        to: transaction.to,
        data: transaction.input,
      });
      if (!order) return unverified;
      return {
        ...base,
        verified: true,
        market: order.key,
        side: order.side,
        inputAmount: order.inputAmount.toString(),
        minAmountOut: order.minAmountOut.toString(),
        blockNumber: receipt.blockNumber.toString(),
      };
    }),
  );
  return mainnetTradesSchema.parse({
    status: "ready",
    observedAt,
    trades,
  });
}
