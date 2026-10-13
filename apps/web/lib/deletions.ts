import "server-only";
import { calls, postSignals } from "@call-my-bluff/database";
import { checkPostAvailability } from "@call-my-bluff/integrations/calls";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { getDatabase } from "./database";

type Check = { status: string; checkedAt: string };
export type PostStatus = "available" | "removed" | "suspected" | "unchecked";

const RECHECK_AFTER_MS = 30 * 60_000;
const SWEEP_PER_REQUEST = 12;
// Two consecutive "not publicly available" lookups before we call a post
// removed. One missing embed can be a lookup failure, a protected account or
// a suspension, so a single miss stays "suspected".
export function statusFromChecks(checks: Check[]): PostStatus {
  const last = checks.at(-1);
  if (!last) return "unchecked";
  if (last.status === "available") return "available";
  if (last.status !== "not-publicly-available") return "unchecked";
  const prior = checks.at(-2);
  return prior?.status === "not-publicly-available" ? "removed" : "suspected";
}

function readChecks(value: unknown): Check[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((c) =>
    c && typeof c.status === "string" && typeof c.checkedAt === "string"
      ? [{ status: c.status, checkedAt: c.checkedAt }]
      : [],
  );
}

/** Re-checks the stalest indexed posts a few at a time; bounded per request. */
export async function sweepIndexedPosts(handle?: string) {
  const database = getDatabase();
  if (!database) return;
  const rows = await database.db
    .select({
      postId: postSignals.postId,
      availability: sql<unknown>`${postSignals.signal}->'availability'`,
    })
    .from(postSignals)
    .where(handle ? eq(postSignals.handle, handle) : undefined)
    .orderBy(asc(postSignals.classifiedAt))
    .limit(500);
  const cutoff = Date.now() - RECHECK_AFTER_MS;
  const due = rows
    .map((row) => ({ ...row, checks: readChecks(row.availability) }))
    .filter((row) => {
      const last = row.checks.at(-1);
      return !last || Date.parse(last.checkedAt) <= cutoff;
    })
    .sort(
      (a, b) =>
        Date.parse(a.checks.at(-1)?.checkedAt ?? "1970-01-01") -
        Date.parse(b.checks.at(-1)?.checkedAt ?? "1970-01-01"),
    )
    .slice(0, SWEEP_PER_REQUEST);
  await Promise.all(
    due.map(async (row) => {
      const result = await checkPostAvailability(row.postId).catch(() => null);
      if (!result || result.status === "unavailable") return;
      const next = [
        ...row.checks,
        { status: result.status, checkedAt: result.checkedAt },
      ].slice(-6);
      await database.db
        .update(postSignals)
        .set({
          signal: sql`jsonb_set(${postSignals.signal}, '{availability}', ${JSON.stringify(next)}::jsonb)`,
        })
        .where(eq(postSignals.postId, row.postId))
        .catch(() => undefined);
    }),
  );
}

/**
 * Persists one live check against every stored copy of the post (captured
 * signal and registered call) so a later count sees what the viewer just saw.
 * Failed lookups ("unavailable") are not evidence and are not stored.
 */
export async function recordPostCheck(
  postId: string,
  result: { status: string; checkedAt: string },
) {
  const database = getDatabase();
  if (!database || result.status === "unavailable") return;
  const check = { status: result.status, checkedAt: result.checkedAt };
  const [signals, callRows] = await Promise.all([
    database.db
      .select({
        postId: postSignals.postId,
        availability: sql<unknown>`${postSignals.signal}->'availability'`,
      })
      .from(postSignals)
      .where(eq(postSignals.postId, postId)),
    database.db
      .select({
        id: calls.id,
        availability: sql<unknown>`${calls.evidence}->'availability'`,
      })
      .from(calls)
      .where(eq(calls.postId, postId)),
  ]);
  await Promise.all([
    ...signals.map((row) =>
      database.db
        .update(postSignals)
        .set({
          signal: sql`jsonb_set(${postSignals.signal}, '{availability}', ${JSON.stringify([...readChecks(row.availability), check].slice(-6))}::jsonb)`,
        })
        .where(eq(postSignals.postId, row.postId)),
    ),
    ...callRows.map((row) =>
      database.db
        .update(calls)
        .set({
          evidence: sql`jsonb_set(${calls.evidence}, '{availability}', ${JSON.stringify([...readChecks(row.availability), check].slice(-6))}::jsonb)`,
        })
        .where(eq(calls.id, row.id)),
    ),
  ]);
}

/** Merges registered-call checks into captured-post coverage, one entry per post. */
export function mergeCallAvailability(
  totals: DeletionReport["totals"],
  seenPostIds: Set<string>,
  callChecks: { postId: string; availability?: Check[] }[],
) {
  const next = { ...totals };
  for (const call of callChecks) {
    if (seenPostIds.has(call.postId)) continue;
    seenPostIds.add(call.postId);
    const checks = call.availability ?? [];
    const status = statusFromChecks(checks);
    next.indexed++;
    if (checks.length) next.checked++;
    if (status === "removed") next.removed++;
    if (status === "suspected") next.suspected++;
  }
  return next;
}

export type DeletionReport = {
  since: string;
  observedAt: string;
  totals: {
    indexed: number;
    checked: number;
    removed: number;
    suspected: number;
  };
  creators: {
    handle: string;
    indexed: number;
    checked: number;
    removed: number;
    suspected: number;
    posts: {
      postId: string;
      asset: string | null;
      direction: string | null;
      indexedAt: string;
      lastCheckedAt: string | null;
      status: PostStatus;
    }[];
  }[];
  note: string;
  /** Every post counted above; used to dedupe merges, not for public output. */
  indexedPostIds: string[];
};

/**
 * Posts we indexed since `since` that were later checked and are no longer
 * public. Deletion is only provable for posts we captured: it says nothing
 * about posts we never saw.
 */
export async function deletionReport(options: {
  since: Date;
  handle?: string;
  sweep?: boolean;
}): Promise<DeletionReport | null> {
  const database = getDatabase();
  if (!database) return null;
  if (options.sweep) await sweepIndexedPosts(options.handle).catch(() => {});
  const rows = await database.db
    .select({
      handle: postSignals.handle,
      postId: postSignals.postId,
      asset: postSignals.asset,
      direction: postSignals.direction,
      classifiedAt: postSignals.classifiedAt,
      availability: sql<unknown>`${postSignals.signal}->'availability'`,
    })
    .from(postSignals)
    .where(
      and(
        gte(postSignals.classifiedAt, options.since),
        options.handle ? eq(postSignals.handle, options.handle) : undefined,
      ),
    )
    .limit(2000);
  const byHandle = new Map<string, DeletionReport["creators"][number]>();
  for (const row of rows) {
    const checks = readChecks(row.availability);
    const status = statusFromChecks(checks);
    const entry = byHandle.get(row.handle) ?? {
      handle: row.handle,
      indexed: 0,
      checked: 0,
      removed: 0,
      suspected: 0,
      posts: [],
    };
    entry.indexed++;
    if (checks.length) entry.checked++;
    if (status === "removed") entry.removed++;
    if (status === "suspected") entry.suspected++;
    if (status === "removed" || status === "suspected")
      entry.posts.push({
        postId: row.postId,
        asset: row.asset,
        direction: row.direction,
        indexedAt: row.classifiedAt.toISOString(),
        lastCheckedAt: checks.at(-1)?.checkedAt ?? null,
        status,
      });
    byHandle.set(row.handle, entry);
  }
  const creators = [...byHandle.values()].sort(
    (a, b) =>
      b.removed - a.removed ||
      b.suspected - a.suspected ||
      b.indexed - a.indexed,
  );
  return {
    since: options.since.toISOString(),
    observedAt: new Date().toISOString(),
    totals: creators.reduce(
      (t, c) => ({
        indexed: t.indexed + c.indexed,
        checked: t.checked + c.checked,
        removed: t.removed + c.removed,
        suspected: t.suspected + c.suspected,
      }),
      { indexed: 0, checked: 0, removed: 0, suspected: 0 },
    ),
    creators: creators.slice(0, 50),
    indexedPostIds: rows.map((row) => row.postId),
    note: "Counts posts Xtrading indexed in this window that X's public embed endpoint later stopped serving (two consecutive checks). A missing embed can also mean a protected or suspended account.",
  };
}
