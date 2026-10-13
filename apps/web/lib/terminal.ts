import "server-only";
import { calls, postSignals } from "@call-my-bluff/database";
import {
  assessKol,
  callEvidenceSchema,
  normalizeHandle,
  postSignalSchema,
  tradeReviewPath,
} from "@call-my-bluff/domain";
import { deriveTradeRoute } from "@call-my-bluff/integrations/signals";
import { and, desc, gt, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { publicCallLedger } from "./calls";
import { getDatabase } from "./database";
import { perplSnapshot } from "./markets";

export const terminalQuerySchema = z.object({
  filter: z.enum(["all", "calls", "high"]).default("calls"),
  handles: z
    .string()
    .max(4000)
    .optional()
    .transform((value) =>
      value
        ? [
            ...new Set(
              value
                .split(",")
                .map((h) => normalizeHandle(h))
                .filter((h): h is string => Boolean(h)),
            ),
          ].slice(0, 500)
        : null,
    ),
  q: z
    .string()
    .max(40)
    .regex(/^[\w$@ .-]*$/)
    .optional(),
});

let perplCache: {
  at: number;
  markets: Awaited<ReturnType<typeof perplSnapshot>>["markets"];
} | null = null;
async function perplMarkets() {
  if (perplCache && Date.now() - perplCache.at < 300_000)
    return perplCache.markets;
  const markets = await perplSnapshot()
    .then((s) => s.markets)
    .catch(() => perplCache?.markets ?? []);
  perplCache = { at: Date.now(), markets };
  return markets;
}

/**
 * Live feed of posts classified by the extension, newest first, optionally
 * limited to followed handles. Each card carries its registered-call
 * resolution when the creator registered it; detected calls stay unscored.
 */
export async function terminalFeed(input: z.infer<typeof terminalQuerySchema>) {
  const database = getDatabase();
  if (!database) return null;
  const { db } = database;
  if (input.handles && input.handles.length === 0)
    return { items: [], observedAt: new Date().toISOString() };
  const conditions = [
    input.filter !== "all" ? sql`${postSignals.isCall} = true` : undefined,
    input.filter === "high"
      ? sql`${postSignals.signal}->>'confidence' = 'high'`
      : undefined,
    input.handles ? inArray(postSignals.handle, input.handles) : undefined,
    input.q
      ? or(
          ilike(postSignals.handle, `%${input.q.replace(/^@/, "")}%`),
          ilike(postSignals.asset, `%${input.q.replace(/^\$/, "")}%`),
          sql`${postSignals.signal}->>'summary' ilike ${`%${input.q}%`}`,
        )
      : undefined,
  ].filter(Boolean);
  const rows = await db
    .select({ signal: postSignals.signal })
    .from(postSignals)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(postSignals.classifiedAt))
    .limit(40);
  const signals = rows.flatMap((row) => {
    const parsed = postSignalSchema.safeParse(row.signal);
    return parsed.success ? [parsed.data] : [];
  });
  const registered = signals.length
    ? await db
        .select({
          id: calls.id,
          postId: calls.postId,
          status: calls.status,
          evidence: calls.evidence,
        })
        .from(calls)
        .where(
          inArray(
            calls.postId,
            signals.map((s) => s.postId),
          ),
        )
    : [];
  const byPost = new Map(registered.map((c) => [c.postId, c]));
  const markets = await perplMarkets();
  const now = Date.now();
  return {
    items: signals.map((signal) => {
      const route = deriveTradeRoute(signal, markets);
      const call = byPost.get(signal.postId);
      const evidence = call
        ? callEvidenceSchema.safeParse(call.evidence)
        : null;
      const terms = evidence?.success ? evidence.data : null;
      const checks = terms?.availability ?? [];
      return {
        signal,
        trade: {
          buy: tradeReviewPath(signal, route, "buy"),
          sell: tradeReviewPath(signal, route, "sell"),
        },
        registered: terms
          ? {
              callId: call?.id ?? null,
              asset: terms.terms.assetId,
              direction: terms.terms.direction,
              start: Number(terms.entry.timestamp) * 1000,
              expiry: Number(terms.terms.expiry) * 1000,
              outcome: terms.outcome,
              returnBps: terms.returnBps,
            }
          : null,
        removed:
          checks.length >= 2 &&
          checks.slice(-2).every((c) => c.status === "not-publicly-available"),
        ageMs: now - Date.parse(signal.classifiedAt),
      };
    }),
    observedAt: new Date().toISOString(),
  };
}

/** Tickers called most in the last 7 days, with net direction. */
export async function trendingTickers() {
  const database = getDatabase();
  if (!database) return null;
  const rows = await database.db
    .select({
      asset: postSignals.asset,
      direction: postSignals.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(postSignals)
    .where(
      and(
        sql`${postSignals.isCall} = true`,
        sql`${postSignals.asset} is not null`,
        gt(postSignals.classifiedAt, new Date(Date.now() - 7 * 86_400_000)),
      ),
    )
    .groupBy(postSignals.asset, postSignals.direction);
  const byAsset = new Map<
    string,
    { up: number; down: number; other: number }
  >();
  for (const row of rows) {
    if (!row.asset) continue;
    const entry = byAsset.get(row.asset) ?? { up: 0, down: 0, other: 0 };
    if (row.direction === "bullish") entry.up += row.count;
    else if (row.direction === "bearish") entry.down += row.count;
    else entry.other += row.count;
    byAsset.set(row.asset, entry);
  }
  return [...byAsset]
    .map(([asset, c]) => {
      const total = c.up + c.down + c.other;
      const bias =
        c.up >= total * 0.7
          ? "long"
          : c.down >= total * 0.7
            ? "short"
            : "mixed";
      return { asset, calls: total, bias };
    })
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 8);
}

/** Totals for the integrity panel. */
export async function terminalIntegrity() {
  const database = getDatabase();
  if (!database) return null;
  const [signals] = await database.db
    .select({
      indexed: sql<number>`count(*)::int`,
      callsDetected: sql<number>`count(*) filter (where ${postSignals.isCall})::int`,
    })
    .from(postSignals);
  const [registered] = await database.db
    .select({
      registered: sql<number>`count(*)::int`,
      scored: sql<number>`count(*) filter (where ${calls.status} = 'resolved')::int`,
    })
    .from(calls);
  return { ...signals, ...registered };
}

const railCache = new Map<string, { at: number; value: unknown }>();
/**
 * Who to follow or fade: median return and hit rate of registered, scored
 * calls. Detected posts never count; no scored calls means no verdict.
 */
export async function creatorRail(handles: string[]) {
  const key = handles.join(",");
  const hit = railCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const rows = await Promise.all(
    handles.slice(0, 8).map(async (handle) => {
      const ledger = await publicCallLedger(handle).catch(() => null);
      const a = assessKol({ calls: ledger?.calls ?? [], swaps: [] });
      const serious = a.flags.some((f) => f.severity === "serious");
      const verdict =
        a.scored === 0
          ? "unscored"
          : serious ||
              (a.medianBps !== null && a.medianBps < 0) ||
              (a.hitBps ?? 0) < 4000
            ? "fade"
            : (a.hitBps ?? 0) >= 5000 && (a.medianBps ?? 0) > 0
              ? "follow"
              : "neutral";
      return {
        handle,
        scored: a.scored,
        hits: a.hits,
        medianBps: a.medianBps,
        tier: a.tier,
        flags: a.flags.filter((f) => f.severity === "serious").length,
        verdict,
      };
    }),
  );
  const value = rows.sort(
    (x, y) => y.scored - x.scored || x.handle.localeCompare(y.handle),
  );
  if (railCache.size > 200) railCache.clear();
  railCache.set(key, { at: Date.now(), value });
  return value;
}
