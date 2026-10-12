import "server-only";
import { tradeIntents } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  type KuruActivity,
  kuruActivitySchema,
  recordTradeSchema,
} from "@call-my-bluff/domain";
import {
  type KuruMarketKey,
  kuruUsdc,
  kuruV2,
  orderBookAbi,
} from "@call-my-bluff/integrations/kuru";
import { and, eq, inArray } from "drizzle-orm";
import { type Address, decodeEventLog, getAddress, type Hex } from "viem";
import { getDatabase } from "./database";
import { identityContext } from "./identity-http";
import { testnetClient } from "./markets";

const marketKeys = new Map<string, KuruMarketKey>(
  (Object.keys(kuruV2.markets) as KuruMarketKey[]).map((key) => [
    kuruV2.markets[key].market.toLowerCase(),
    key,
  ]),
);
const tokenSymbols = new Map<string, "USDC" | "WETH" | "WBTC">([
  [kuruUsdc.address.toLowerCase(), "USDC"],
  [kuruV2.markets.WETH.base.address.toLowerCase(), "WETH"],
  [kuruV2.markets.WBTC.base.address.toLowerCase(), "WBTC"],
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
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  if (!endpoint) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ENVIO_HASURA_ADMIN_SECRET
        ? { "X-Hasura-Admin-Secret": process.env.ENVIO_HASURA_ADMIN_SECRET }
        : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) return null;
  const result = (await response.json()) as {
    data?: Record<string, Row[]>;
    errors?: unknown;
  };
  return result.errors || !result.data ? null : result.data;
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

/**
 * Links a confirmed swap to the post that prompted it. The receipt must show a
 * successful call from the bound wallet to a configured market with a SpotSwap
 * log; the post ID itself remains user-supplied.
 */
export async function recordTrade(request: Request, body: unknown) {
  const parsed = recordTradeSchema.safeParse(body);
  if (!parsed.success) throw new IdentityError("invalid_trade_record");
  const { wallet, privyUserId } = await boundWallet(request);
  const hash = parsed.data.transactionHash.toLowerCase() as Hex;
  const client = testnetClient();
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }),
  ]).catch(() => {
    throw new IdentityError("transaction_unavailable", 409);
  });
  const market = transaction.to
    ? marketKeys.get(transaction.to.toLowerCase())
    : undefined;
  if (
    receipt.status !== "success" ||
    transaction.from.toLowerCase() !== wallet.toLowerCase() ||
    !market
  )
    throw new IdentityError("not_a_confirmed_swap", 409);
  let swap: { isBuy: boolean; amountInUsed: bigint } | null = null;
  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() !== kuruV2.markets[market].market.toLowerCase()
    )
      continue;
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
    chainId: 10143,
    market: kuruV2.markets[market].market.toLowerCase(),
    side: swap.isBuy ? "buy" : "sell",
    amount: swap.amountInUsed.toString(),
    sourcePostId: parsed.data.sourcePostId,
    transactionHash: hash,
  });
  return { recorded: true };
}
