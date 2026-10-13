import "server-only";
import { postSignals } from "@call-my-bluff/database";
import {
  type NansenCheck,
  normalizeHandle,
  type Reputation,
} from "@call-my-bluff/domain";
import {
  CALL_ASSETS,
  observePrice,
  postTimestampMs,
} from "@call-my-bluff/integrations/calls";
import { createNansenClient } from "@call-my-bluff/integrations/nansen";
import {
  assessConsistency,
  type WalletTrade,
} from "@call-my-bluff/integrations/signals";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "./database";
import { spotPrices } from "./prices";
import { publicCreatorEvidence } from "./public-creator";

const ENTRY_LOOKUPS_PER_REQUEST = 6;
const toDecimal = (units: bigint) => {
  const text = units.toString().padStart(9, "0");
  return `${text.slice(0, -8)}.${text.slice(-8)}`.replace(/\.?0+$/, "");
};

/** Current price in 8-decimal units: Binance for BTC/ETH/SOL, Kuru mainnet for MON. */
async function priceNow(asset: keyof typeof CALL_ASSETS) {
  if (asset === "MON") {
    const mon = (await spotPrices().catch(() => null))?.prices.find(
      (p) => p.asset === "MON",
    );
    if (!mon) return null;
    const [whole = "0", fraction = ""] = mon.price.split(".");
    return BigInt(whole + fraction.slice(0, 8).padEnd(8, "0"));
  }
  const now = await observePrice(asset, Math.floor(Date.now() / 1000) - 180);
  return now ? BigInt(now.price) : null;
}

/**
 * Prices each detected call from the minute it was posted to now, signed by
 * its direction. Entry prices never change, so they are stored on the signal
 * row once (bounded lookups per request; MON entries cost Nansen credits).
 */
async function measureDetected(
  rows: {
    postId: string;
    asset: string | null;
    direction: "bullish" | "bearish" | null;
    entry: unknown;
  }[],
) {
  const database = getDatabase();
  if (!database) return undefined;
  const priced: Record<string, bigint | null> = {};
  let lookups = 0;
  const items = [];
  for (const row of rows) {
    const asset = row.asset as keyof typeof CALL_ASSETS | null;
    if (!asset || !(asset in CALL_ASSETS) || !row.direction) continue;
    const postedSec = Math.floor(Number(postTimestampMs(row.postId)) / 1000);
    let entry =
      typeof row.entry === "string" && /^[0-9]+$/.test(row.entry)
        ? BigInt(row.entry)
        : null;
    if (entry === null && lookups < ENTRY_LOOKUPS_PER_REQUEST) {
      lookups++;
      const observed = await observePrice(asset, postedSec, {
        nansenApiKey: process.env.NANSEN_API_KEY,
      }).catch(() => null);
      if (observed) {
        entry = BigInt(observed.price);
        await database.db
          .update(postSignals)
          .set({
            signal: sql`jsonb_set(${postSignals.signal}, '{entryPrice}', ${JSON.stringify(observed.price)}::jsonb)`,
          })
          .where(eq(postSignals.postId, row.postId))
          .catch(() => undefined);
      }
    }
    if (entry === null || entry === 0n) continue;
    if (!(asset in priced))
      priced[asset] = await priceNow(asset).catch(() => null);
    const now = priced[asset];
    if (!now) continue;
    const raw = Number(((now - entry) * 10000n) / entry);
    items.push({
      postId: row.postId,
      asset,
      direction: row.direction,
      entryPrice: toDecimal(entry),
      nowPrice: toDecimal(now),
      moveBps: row.direction === "bullish" ? raw : -raw,
      postedAt: new Date(postedSec * 1000).toISOString(),
    });
  }
  const moves = items.map((i) => i.moveBps).sort((a, b) => a - b);
  const mid = Math.floor(moves.length / 2);
  return {
    count: items.length,
    inFavour: items.filter((i) => i.moveBps > 0).length,
    medianBps: moves.length
      ? moves.length % 2
        ? (moves[mid] as number)
        : Math.trunc(((moves[mid - 1] as number) + (moves[mid] as number)) / 2)
      : null,
    items: items.slice(0, 20),
  };
}

const methodology =
  "Counts calls extracted from posts seen by extension users (signal-v1). A score needs sourced expiry prices and is not computed yet; hypothetical call outcomes stay separate from wallet returns.";

export async function creatorReputation(handle: string): Promise<Reputation> {
  const empty: Reputation = {
    trackedCalls: 0,
    bullish: 0,
    bearish: 0,
    perpCalls: 0,
    evaluated: 0,
    score: null,
    methodology,
    recent: [],
    status: "unavailable",
  };
  const database = getDatabase();
  if (!database) return empty;
  try {
    const rows = await database.db
      .select({
        postId: postSignals.postId,
        asset: postSignals.asset,
        direction: postSignals.direction,
        instrument: postSignals.instrument,
        classifiedAt: postSignals.classifiedAt,
        entry: sql<unknown>`${postSignals.signal}->>'entryPrice'`,
      })
      .from(postSignals)
      .where(and(eq(postSignals.handle, handle), eq(postSignals.isCall, true)))
      .orderBy(desc(postSignals.classifiedAt))
      .limit(500);
    const measured = await measureDetected(rows.slice(0, 20)).catch(
      () => undefined,
    );
    return {
      ...empty,
      measured,
      status: "ready",
      trackedCalls: rows.length,
      bullish: rows.filter((r) => r.direction === "bullish").length,
      bearish: rows.filter((r) => r.direction === "bearish").length,
      perpCalls: rows.filter((r) => r.instrument === "perp").length,
      recent: rows.slice(0, 5).map((r) => ({
        postId: r.postId,
        asset: r.asset,
        direction: r.direction,
        instrument: r.instrument,
        classifiedAt: r.classifiedAt.toISOString(),
      })),
    };
  } catch {
    return empty;
  }
}

const tradeSchema = z.object({
  data: z
    .array(
      z.object({
        block_timestamp: z.string(),
        transaction_hash: z.string(),
        token_bought_symbol: z.string().nullable().optional(),
        token_sold_symbol: z.string().nullable().optional(),
        trade_value_usd: z.number().nullable().optional(),
      }),
    )
    .max(1000),
});

// Live checks cost Nansen credits; cache per wallet/asset/direction.
const nansenCache = new Map<string, { expires: number; value: NansenCheck }>();
const NANSEN_TTL_MS = 15 * 60_000;

export async function nansenCheck(input: {
  handle: string;
  wallet: string | null;
  asset: string | null;
  direction: "bullish" | "bearish" | null;
}): Promise<NansenCheck> {
  const observedAt = new Date().toISOString();
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const window = { from: from.toISOString(), to: to.toISOString() };
  if (!input.asset || !input.direction)
    return {
      mode: process.env.NANSEN_API_KEY ? "live" : "demo",
      verdict: "not-applicable",
      wallet: input.wallet,
      chain: "monad",
      window: null,
      findings: [],
      note: "A consistency check needs both an asset and a stated direction.",
      observedAt,
    };
  if (!process.env.NANSEN_API_KEY)
    return {
      mode: "demo",
      verdict: "unavailable",
      wallet: null,
      chain: "monad",
      window,
      findings: [],
      note: "Nansen is not configured for this deployment. No wallet observation is made.",
      observedAt,
    };
  if (!input.wallet)
    return {
      mode: "live",
      verdict: "unavailable",
      wallet: null,
      chain: "monad",
      window,
      findings: [],
      note: "No verified wallet binding for this creator; there is no wallet to check.",
      observedAt,
    };
  const cacheKey = `${input.wallet.toLowerCase()}:${input.asset}:${input.direction}`;
  const cached = nansenCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const result = await createNansenClient(process.env.NANSEN_API_KEY).post(
      "/api/v1/profiler/dex-trades",
      {
        address: input.wallet,
        chain: "monad",
        date: window,
        pagination: { page: 1, per_page: 100 },
        order_by: [{ field: "block_timestamp", direction: "DESC" }],
      },
    );
    const trades: WalletTrade[] = tradeSchema
      .parse(result.data)
      .data.map((t) => ({
        boughtSymbol: t.token_bought_symbol ?? null,
        soldSymbol: t.token_sold_symbol ?? null,
        valueUsd: t.trade_value_usd ?? null,
        at: t.block_timestamp,
        transactionHash: t.transaction_hash,
      }));
    const value: NansenCheck = {
      mode: "live",
      ...assessConsistency({ ...input, trades }),
      wallet: input.wallet,
      chain: "monad",
      window,
      note: "Nansen DEX trades on Monad mainnet for the bound wallet over 30 days. One wallet never covers all of a creator's activity; a sale is an observation, not proof of deception.",
      observedAt: result.fetchedAt,
    };
    if (nansenCache.size >= 500) nansenCache.clear();
    nansenCache.set(cacheKey, { expires: Date.now() + NANSEN_TTL_MS, value });
    return value;
  } catch {
    return {
      mode: "live",
      verdict: "unavailable",
      wallet: input.wallet,
      chain: "monad",
      window,
      findings: [],
      note: "Nansen request failed or returned an unexpected shape. No finding is claimed.",
      observedAt,
    };
  }
}

export type CreatorInsights = {
  handle: string;
  evidence: Awaited<ReturnType<typeof publicCreatorEvidence>>;
  reputation: Reputation;
  nansen: NansenCheck;
};
const insightCache = new Map<
  string,
  { expires: number; value: CreatorInsights }
>();

export async function creatorInsights(
  rawHandle: string,
  asset: string | null,
  direction: "bullish" | "bearish" | null,
): Promise<CreatorInsights | null> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return null;
  const key = `${handle}:${asset}:${direction}`;
  const hit = insightCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const evidence = await publicCreatorEvidence(handle);
  const [reputation, nansen] = await Promise.all([
    creatorReputation(handle),
    nansenCheck({
      handle,
      wallet:
        evidence?.identity.status === "bound"
          ? (evidence.identity.wallet ?? null)
          : null,
      asset,
      direction,
    }),
  ]);
  const value: CreatorInsights = { handle, evidence, reputation, nansen };
  if (insightCache.size >= 500) insightCache.clear();
  insightCache.set(key, { expires: Date.now() + 30_000, value });
  return value;
}
