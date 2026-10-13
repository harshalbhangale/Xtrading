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
import { offRegistryContract } from "@call-my-bluff/integrations/nansen-evidence";
import {
  DEFAULT_CALL_HORIZON_SECONDS,
  statedTimeframe,
} from "@call-my-bluff/integrations/signals";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "./database";
import { nansenCheck } from "./nansen";
import { publicCreatorEvidence } from "./public-creator";

// Binance-priced assets are free to look up; MON prices cost Nansen credits.
const ENTRY_LOOKUPS_PER_REQUEST = 30;
const PAID_ENTRY_LOOKUPS_PER_REQUEST = 6;
const MEASURED_CALLS_PER_REQUEST = 60;
const toDecimal = (units: bigint) => {
  const text = units.toString().padStart(9, "0");
  return `${text.slice(0, -8)}.${text.slice(-8)}`.replace(/\.?0+$/, "");
};

// The exit candle must have closed before it is read.
const SETTLE_DELAY_SECONDS = 180;

type StoredPrice = string | null;
const storedPrice = (value: unknown): StoredPrice =>
  typeof value === "string" && /^[0-9]+$/.test(value) && value !== "0"
    ? value
    : null;
/** A stored exit is only valid for the horizon it was taken at. */
const storedExit = (value: unknown, horizonSeconds: number): StoredPrice =>
  value &&
  typeof value === "object" &&
  "horizonSeconds" in value &&
  value.horizonSeconds === horizonSeconds &&
  "price" in value
    ? storedPrice(value.price)
    : null;

/**
 * Scores each detected call over the timeframe its post states ("this week" →
 * 7 days), or DEFAULT_CALL_HORIZON_SECONDS when none is stated, signed by its
 * direction. Both prices are historical candles, fetched once and stored on
 * the signal row, so a settled call never changes. Calls whose timeframe has
 * not ended stay pending; assets without a price source are counted as
 * unpriced, never dropped silently.
 */
async function measureDetected(
  rows: {
    postId: string;
    asset: string | null;
    direction: "bullish" | "bearish" | null;
    text: string | null;
    entry: unknown;
    exit: unknown;
  }[],
) {
  const database = getDatabase();
  if (!database) return undefined;
  let lookups = 0;
  let paidLookups = 0;
  const lookup = async (
    asset: keyof typeof CALL_ASSETS,
    at: number,
    postId: string,
    store: (price: string) => { key: string; value: unknown },
  ) => {
    const paid = asset === "MON";
    if (
      lookups >= ENTRY_LOOKUPS_PER_REQUEST ||
      (paid && paidLookups >= PAID_ENTRY_LOOKUPS_PER_REQUEST)
    )
      return null;
    lookups++;
    if (paid) paidLookups++;
    const observed = await observePrice(asset, at, {
      nansenApiKey: process.env.NANSEN_API_KEY,
    }).catch(() => null);
    if (!observed) return null;
    const { key, value } = store(observed.price);
    await database.db
      .update(postSignals)
      .set({
        signal: sql`jsonb_set(${postSignals.signal}, ${`{${key}}`}, ${JSON.stringify(value)}::jsonb)`,
      })
      .where(eq(postSignals.postId, postId))
      .catch(() => undefined);
    return observed.price;
  };
  const nowSec = Math.floor(Date.now() / 1000);
  const items = [];
  let pending = 0;
  let nextSettlesSec: number | null = null;
  const unpricedAssets = new Set<string>();
  let unpriced = 0;
  for (const row of rows) {
    if (!row.asset || !row.direction) continue;
    if (!(row.asset in CALL_ASSETS)) {
      unpriced++;
      unpricedAssets.add(row.asset);
      continue;
    }
    const asset = row.asset as keyof typeof CALL_ASSETS;
    const postedSec = Math.floor(Number(postTimestampMs(row.postId)) / 1000);
    const stated = row.text ? statedTimeframe(row.text) : null;
    const horizonSeconds = stated ?? DEFAULT_CALL_HORIZON_SECONDS;
    const exitAt = postedSec + horizonSeconds;
    const entry =
      storedPrice(row.entry) ??
      (await lookup(asset, postedSec, row.postId, (price) => ({
        key: "entryPrice",
        value: price,
      })));
    if (nowSec < exitAt + SETTLE_DELAY_SECONDS) {
      pending++;
      nextSettlesSec = Math.min(nextSettlesSec ?? exitAt, exitAt);
      continue;
    }
    const exit = entry
      ? (storedExit(row.exit, horizonSeconds) ??
        (await lookup(asset, exitAt, row.postId, (price) => ({
          key: "exit",
          value: { horizonSeconds, price },
        }))))
      : null;
    if (!entry || !exit) {
      // Lookup failed or the per-request budget ran out; retried next request.
      unpriced++;
      unpricedAssets.add(asset);
      continue;
    }
    const entryUnits = BigInt(entry);
    const raw = Number(((BigInt(exit) - entryUnits) * 10000n) / entryUnits);
    items.push({
      postId: row.postId,
      asset,
      direction: row.direction,
      horizonSeconds,
      timeframeStated: stated !== null,
      entryPrice: toDecimal(entryUnits),
      exitPrice: toDecimal(BigInt(exit)),
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
    pending,
    nextSettlesAt:
      nextSettlesSec === null
        ? null
        : new Date(
            (nextSettlesSec + SETTLE_DELAY_SECONDS) * 1000,
          ).toISOString(),
    unpriced,
    unpricedAssets: [...unpricedAssets].sort(),
    items: items.slice(0, 20),
  };
}

const methodology =
  "Counts calls extracted from posts seen by extension users (signal-v1). Each is priced at post time and at the end of the timeframe the post states (24h if none), from historical candles stored once; open calls are pending. Hypothetical outcomes stay separate from wallet returns.";

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
        text: sql<string | null>`${postSignals.signal}->>'capturedText'`,
        exit: sql<unknown>`${postSignals.signal}->'exit'`,
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

// Nansen findings that the token itself is fake or worthless. Market observations
// (young, thin liquidity, concentration) and "no data" are not accusations.
const TOKEN_RISK_KINDS = new Set([
  "impostor-token",
  "not-canonical",
  "testnet-only-contract",
]);

/**
 * Stores Nansen's verdict on a post's token contract, so the creator record can
 * show it without re-spending credits. Only answered checks are stored; an
 * empty list means Nansen answered and found nothing.
 */
async function recordTokenRisk(postId: string, check: NansenCheck) {
  const database = getDatabase();
  const answered = (check.sources ?? []).some(
    (s) => s.status === "ok" || s.status === "empty",
  );
  if (!database || check.mode !== "live" || !answered) return;
  const flags = (check.flags ?? [])
    .filter((f) => f.severity === "caution" && TOKEN_RISK_KINDS.has(f.kind))
    .map((f) => ({ kind: f.kind, summary: f.summary }));
  const value = { checkedAt: check.observedAt, flags };
  await database.db
    .update(postSignals)
    .set({
      signal: sql`jsonb_set(${postSignals.signal}, '{tokenRisk}', ${JSON.stringify(value)}::jsonb)`,
    })
    .where(eq(postSignals.postId, postId));
}

const CAPTURED_TOKEN_CHECKS_PER_REQUEST = 1;

/**
 * Stored token verdicts for a creator's captured posts. With `checkMissing`,
 * checks at most one never-checked post with Nansen first (bounded credits).
 */
export async function capturedTokenRisks(
  handle: string,
  options: { checkMissing?: boolean } = {},
) {
  const database = getDatabase();
  if (!database) return { risky: [], unverified: [] };
  const load = () =>
    database.db
      .select({
        postId: postSignals.postId,
        asset: postSignals.asset,
        tokenRisk: sql<unknown>`${postSignals.signal}->'tokenRisk'`,
        references: sql<unknown>`${postSignals.signal}->'tokenReferences'`,
      })
      .from(postSignals)
      .where(
        and(
          eq(postSignals.handle, handle),
          sql`jsonb_array_length(coalesce(${postSignals.signal}->'tokenReferences', '[]'::jsonb)) > 0`,
        ),
      )
      .limit(200);
  let rows = await load();
  if (options.checkMissing) {
    const unchecked = rows
      .filter((row) => !row.tokenRisk)
      .slice(0, CAPTURED_TOKEN_CHECKS_PER_REQUEST);
    if (unchecked.length) {
      for (const row of unchecked)
        await creatorInsights(handle, null, null, row.postId).catch(() => null);
      rows = await load();
    }
  }
  const risky: { postId: string; asset: string | null; summary: string }[] = [];
  const unverified: typeof risky = [];
  for (const row of rows) {
    const risk = row.tokenRisk as {
      flags?: { kind: string; summary: string }[];
    } | null;
    for (const flag of risk?.flags ?? [])
      risky.push({
        postId: row.postId,
        asset: row.asset,
        summary: flag.summary,
      });
    // Until Nansen answers, fall back to the free original-contract registry.
    if (risk) continue;
    const references = Array.isArray(row.references) ? row.references : [];
    for (const reference of references) {
      const address =
        reference && typeof reference.address === "string"
          ? reference.address
          : null;
      const summary =
        address && /^0x[0-9a-fA-F]{40}$/.test(address)
          ? offRegistryContract(row.asset, address)
          : null;
      if (summary) {
        unverified.push({ postId: row.postId, asset: row.asset, summary });
        break;
      }
    }
  }
  return { risky, unverified };
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
  if (post && signal?.tokenReferences.length)
    await recordTokenRisk(post, nansen).catch(() => undefined);
  const value: CreatorInsights = { handle, evidence, reputation, nansen };
  if (insightCache.size >= 500) insightCache.clear();
  insightCache.set(key, { expires: Date.now() + 30_000, value });
  return value;
}
