import "server-only";
import { postSignals } from "@call-my-bluff/database";
import {
  type NansenCheck,
  normalizeHandle,
  postSignalSchema,
  type Reputation,
} from "@call-my-bluff/domain";
import {
  CALL_ASSETS,
  observePrice,
  postTimestampMs,
} from "@call-my-bluff/integrations/calls";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "./database";
import { nansenCheck } from "./nansen";
import { spotPrices } from "./prices";
import { publicCreatorEvidence } from "./public-creator";

// Binance-priced assets are free to look up; MON entries cost Nansen credits.
const ENTRY_LOOKUPS_PER_REQUEST = 30;
const PAID_ENTRY_LOOKUPS_PER_REQUEST = 6;
const MEASURED_CALLS_PER_REQUEST = 60;
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
  let paidLookups = 0;
  const items = [];
  for (const row of rows) {
    const asset = row.asset as keyof typeof CALL_ASSETS | null;
    if (!asset || !(asset in CALL_ASSETS) || !row.direction) continue;
    const postedSec = Math.floor(Number(postTimestampMs(row.postId)) / 1000);
    let entry =
      typeof row.entry === "string" && /^[0-9]+$/.test(row.entry)
        ? BigInt(row.entry)
        : null;
    const paid = asset === "MON";
    if (
      entry === null &&
      lookups < ENTRY_LOOKUPS_PER_REQUEST &&
      (!paid || paidLookups < PAID_ENTRY_LOOKUPS_PER_REQUEST)
    ) {
      lookups++;
      if (paid) paidLookups++;
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
    const measured = await measureDetected(
      rows.slice(0, MEASURED_CALLS_PER_REQUEST),
    ).catch(() => undefined);
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

/**
 * The classification stored for this creator's post. Token addresses come only
 * from here, never from the caller, so a request cannot spend credits on
 * arbitrary contracts.
 */
async function storedSignal(handle: string, postId: string) {
  const database = getDatabase();
  if (!database) return null;
  try {
    const rows = await database.db
      .select({ signal: postSignals.signal })
      .from(postSignals)
      .where(
        and(eq(postSignals.postId, postId), eq(postSignals.handle, handle)),
      )
      .limit(1);
    const parsed = postSignalSchema.safeParse(rows[0]?.signal);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Post time from the X post ID (snowflake); null if it is not a plausible past time. */
function postedAt(postId: string | null) {
  if (!postId) return null;
  const ms = Number(postTimestampMs(postId));
  return ms > 1288834974657 && ms <= Date.now() + 60_000 ? ms : null;
}

export async function creatorInsights(
  rawHandle: string,
  asset: string | null,
  direction: "bullish" | "bearish" | null,
  postId: string | null = null,
): Promise<CreatorInsights | null> {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return null;
  const post = postId && /^[0-9]{1,30}$/.test(postId) ? postId : null;
  const key = `${handle}:${asset}:${direction}:${post}`;
  const hit = insightCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const [evidence, signal] = await Promise.all([
    publicCreatorEvidence(handle),
    post ? storedSignal(handle, post) : Promise.resolve(null),
  ]);
  const [reputation, nansen] = await Promise.all([
    creatorReputation(handle),
    nansenCheck({
      wallet:
        evidence?.identity.status === "bound"
          ? (evidence.identity.wallet ?? null)
          : null,
      // The stored classification wins over request parameters.
      // A stored non-call has no asset; keep the card's asset for token data.
      asset: signal?.asset ?? asset,
      direction: signal ? signal.direction : direction,
      instrument: signal?.instrument ?? null,
      tokenReferences: signal?.tokenReferences ?? [],
      callAt: postedAt(post),
    }),
  ]);
  const value: CreatorInsights = { handle, evidence, reputation, nansen };
  if (insightCache.size >= 500) insightCache.clear();
  insightCache.set(key, { expires: Date.now() + 30_000, value });
  return value;
}
