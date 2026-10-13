import "server-only";
import { calls, creators } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  type CallEvidence,
  callEvidenceSchema,
  callRegistrationSchema,
  type IndexedCallBond,
  indexedCallBondSchema,
  normalizeHandle,
  type PublicCall,
  publicCallLedgerSchema,
} from "@call-my-bluff/domain";
import { evaluateExpiredCall } from "@call-my-bluff/integrations/call-evaluation";
import {
  CALL_HORIZONS,
  CALL_METHODOLOGY,
  checkPostAvailability,
  fetchPublicPost,
  observePrice,
  PRICE_TOLERANCE_SECONDS,
  parsePostUrl,
  postTimestampMs,
  REGISTRATION_WINDOW_SECONDS,
} from "@call-my-bluff/integrations/calls";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getAddress } from "viem";
import { onchainCallId } from "./call-settlement";
import { getDatabase } from "./database";
import { envioQuery } from "./envio";
import { identityContext, requireX } from "./identity-http";

const DAILY_LIMIT = 10;
// Bounds provider usage per page view; remaining due calls resolve on later views.
const EVALUATIONS_PER_REQUEST = 4;
const RETRY_AFTER_MS = 10 * 60_000;
const priceOptions = () => ({ nansenApiKey: process.env.NANSEN_API_KEY });

export async function registerCall(request: Request, input: unknown) {
  const { user, service } = await identityContext(request);
  const identity = requireX(user);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== identity.xUserId ||
    binding.handle !== identity.handle ||
    !identity.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("binding_required", 409);
  const body = callRegistrationSchema.safeParse(input);
  if (!body.success) throw new IdentityError("invalid_call");
  const url = parsePostUrl(body.data.postUrl);
  if (!url) throw new IdentityError("invalid_post_url");

  const now = Date.now();
  const publishedMs = Number(postTimestampMs(url.postId));
  if (publishedMs > now + 60_000) throw new IdentityError("invalid_post_url");
  if (now - publishedMs > REGISTRATION_WINDOW_SECONDS * 1000)
    throw new IdentityError("post_too_old", 409);

  let post: Awaited<ReturnType<typeof fetchPublicPost>>;
  try {
    post = await fetchPublicPost(url.postId);
  } catch {
    throw new IdentityError("post_lookup_unavailable", 503);
  }
  if (!post) throw new IdentityError("post_not_found", 404);
  if (post.authorHandle !== binding.handle)
    throw new IdentityError("post_not_yours", 403);

  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const [creator] = await database.db
    .select({ id: creators.id })
    .from(creators)
    .where(eq(creators.xUserId, binding.xUserId))
    .limit(1);
  if (!creator) throw new IdentityError("binding_required", 409);
  const [recent] = await database.db
    .select({ count: sql<number>`count(*)::int` })
    .from(calls)
    .where(
      and(
        eq(calls.creatorId, creator.id),
        gt(calls.capturedAt, new Date(now - 86_400_000)),
      ),
    );
  if ((recent?.count ?? 0) >= DAILY_LIMIT)
    throw new IdentityError("call_rate_limited", 429);

  const publishedSeconds = Math.ceil(publishedMs / 1000);
  const entry = await observePrice(
    body.data.asset,
    publishedSeconds,
    priceOptions(),
  ).catch(() => null);
  if (!entry) throw new IdentityError("price_unavailable", 503);

  const evidence: CallEvidence = {
    post: {
      authorHandle: post.authorHandle,
      text: post.text,
      verifiedAt: new Date(now).toISOString(),
    },
    horizon: body.data.horizon,
    terms: {
      methodology: CALL_METHODOLOGY,
      assetId: body.data.asset,
      sourceId: entry.sourceId,
      direction: body.data.direction,
      entryPrice: entry.price,
      priceDecimals: entry.priceDecimals,
      expiry: String(publishedSeconds + CALL_HORIZONS[body.data.horizon]),
      toleranceSeconds: String(PRICE_TOLERANCE_SECONDS),
      targetBps: String(body.data.targetBps),
    },
    entry,
    exit: null,
    outcome: null,
    returnBps: null,
    lastAttemptAt: null,
  };
  const [row] = await database.db
    .insert(calls)
    .values({
      creatorId: creator.id,
      postId: url.postId,
      sourceUrl: `https://x.com/${binding.handle}/status/${url.postId}`,
      publishedAt: new Date(publishedMs),
      evidence: callEvidenceSchema.parse(evidence),
      methodologyVersion: CALL_METHODOLOGY,
      status: "eligible",
    })
    .onConflictDoNothing({ target: calls.postId })
    .returning({ id: calls.id });
  if (!row) throw new IdentityError("call_exists", 409);
  return { id: row.id };
}

function returnBps(evidence: CallEvidence, exitPrice: string) {
  const entry = BigInt(evidence.terms.entryPrice);
  const change = (BigInt(exitPrice) - entry) * 10000n;
  const raw = change / entry;
  return evidence.terms.direction === "up" ? raw : -raw;
}

type CallRow = typeof calls.$inferSelect;
async function evaluateDue(rows: CallRow[]) {
  const database = getDatabase();
  if (!database) return rows;
  const now = Date.now();
  let budget = EVALUATIONS_PER_REQUEST;
  const result: CallRow[] = [];
  for (const row of rows) {
    const parsed = callEvidenceSchema.safeParse(row.evidence);
    if (row.status !== "eligible" || !parsed.success || budget === 0) {
      result.push(row);
      continue;
    }
    const evidence = parsed.data;
    const expiry = Number(evidence.terms.expiry);
    const lastAttempt = evidence.lastAttemptAt
      ? Date.parse(evidence.lastAttemptAt)
      : 0;
    if (expiry * 1000 > now - 60_000 || now - lastAttempt < RETRY_AFTER_MS) {
      result.push(row);
      continue;
    }
    budget -= 1;
    const exit = await observePrice(
      evidence.terms.assetId,
      expiry,
      priceOptions(),
    ).catch(() => null);
    const verdict = evaluateExpiredCall(
      evidence.terms,
      exit,
      String(Math.floor(now / 1000)),
    );
    const next: CallEvidence =
      verdict.outcome === "unresolved" || !exit
        ? { ...evidence, lastAttemptAt: new Date(now).toISOString() }
        : {
            ...evidence,
            exit,
            outcome: verdict.outcome,
            returnBps: returnBps(evidence, exit.price).toString(),
            lastAttemptAt: new Date(now).toISOString(),
          };
    const status = next.outcome ? "resolved" : "eligible";
    // The status guard keeps concurrent evaluations idempotent.
    const [updated] = await database.db
      .update(calls)
      .set({ evidence: next, status })
      .where(and(eq(calls.id, row.id), eq(calls.status, "eligible")))
      .returning();
    result.push(updated ?? row);
  }
  return result;
}

type BondRow = {
  callId: string;
  contract: string;
  status: string;
  bond: string;
  reward: string;
  start: string;
  expiry: string;
  entryPrice: string | null;
  exitPrice: string | null;
  payout: string | null;
  registeredTx: string;
  settledTx: string | null;
};
/** Indexed CallSettlement bonds for these calls, keyed by ledger call ID. */
async function indexedBonds(ids: string[]) {
  const contract = process.env.CALL_SETTLEMENT_ADDRESS;
  if (!contract)
    return {
      status: "unconfigured" as const,
      progressBlock: null,
      bonds: null,
    };
  const onchain = new Map(ids.map((id) => [onchainCallId(id), id]));
  try {
    const result = await envioQuery(
      `query Bonds($contract: String!, $ids: [String!]!) {
        _meta(where: {chainId: {_eq: 10143}}) {progressBlock}
        CallBond(where: {chainId: {_eq: 10143}, contract: {_eq: $contract}, callId: {_in: $ids}}) {
          callId contract status bond reward start expiry entryPrice exitPrice payout registeredTx settledTx
        }
      }`,
      { contract: contract.toLowerCase(), ids: [...onchain.keys()] },
    );
    const data = result?.errors ? undefined : result?.data;
    const meta = (data?._meta as { progressBlock: number }[] | undefined)?.[0];
    const rows = data?.CallBond as BondRow[] | undefined;
    if (!meta || !rows) throw new Error("unavailable");
    const bonds = new Map<string, IndexedCallBond>();
    for (const row of rows) {
      const id = onchain.get(row.callId as `0x${string}`);
      const parsed = indexedCallBondSchema.safeParse({
        ...row,
        contract: getAddress(row.contract),
      });
      if (id && parsed.success) bonds.set(id, parsed.data);
    }
    return {
      status: "indexed" as const,
      progressBlock: String(meta.progressBlock),
      bonds,
    };
  } catch {
    return { status: "unavailable" as const, progressBlock: null, bonds: null };
  }
}

const RECHECK_AFTER_MS = 6 * 3600_000;
const RECHECKS_PER_REQUEST = 3;
/**
 * Re-checks whether registered posts are still publicly served, oldest check
 * first, and appends the observation to the call (last six kept). Bounded per
 * request; "unavailable" means the lookup failed, not that the post is gone.
 */
async function recheckAvailability(rows: CallRow[]) {
  const database = getDatabase();
  if (!database) return rows;
  const now = Date.now();
  const due = rows
    .map((row) => ({
      row,
      evidence: callEvidenceSchema.safeParse(row.evidence),
    }))
    .filter(
      ({ row, evidence }) => row.status !== "excluded" && evidence.success,
    )
    .map(({ row, evidence }) => {
      const checks = evidence.data?.availability ?? [];
      const last = checks.at(-1);
      return { row, checks, last: last ? Date.parse(last.checkedAt) : 0 };
    })
    .filter(({ last }) => now - last >= RECHECK_AFTER_MS)
    .sort((a, b) => a.last - b.last)
    .slice(0, RECHECKS_PER_REQUEST);
  const updated = new Map<string, CallRow>();
  await Promise.all(
    due.map(async ({ row, checks }) => {
      const result = await checkPostAvailability(row.postId);
      const next = [
        ...checks,
        { status: result.status, checkedAt: result.checkedAt },
      ].slice(-6);
      // Touch only the availability key so concurrent evaluation is not lost.
      const [saved] = await database.db
        .update(calls)
        .set({
          evidence: sql`jsonb_set(${calls.evidence}, '{availability}', ${JSON.stringify(next)}::jsonb)`,
        })
        .where(eq(calls.id, row.id))
        .returning();
      if (saved) updated.set(row.id, saved);
    }),
  );
  return rows.map((row) => updated.get(row.id) ?? row);
}

/** Records one on-demand availability check against a stored call. */
export async function recordAvailability(
  callId: string,
  result: {
    status: "available" | "not-publicly-available" | "unavailable";
    checkedAt: string;
  },
) {
  const database = getDatabase();
  if (!database) return;
  const [row] = await database.db
    .select({ evidence: calls.evidence })
    .from(calls)
    .where(eq(calls.id, callId))
    .limit(1);
  const evidence = callEvidenceSchema.safeParse(row?.evidence);
  if (!evidence.success) return;
  const next = [...(evidence.data.availability ?? []), result].slice(-6);
  await database.db
    .update(calls)
    .set({
      evidence: sql`jsonb_set(${calls.evidence}, '{availability}', ${JSON.stringify(next)}::jsonb)`,
    })
    .where(eq(calls.id, callId));
}

/** Public call ledger for a handle; null when the handle has no unique binding. */
export async function publicCallLedger(
  input: string,
  options: { recheck?: boolean } = {},
) {
  const handle = normalizeHandle(input);
  const database = getDatabase();
  if (!handle || !database) return null;
  const owners = await database.db
    .select({ id: creators.id })
    .from(creators)
    .where(eq(creators.handle, handle))
    .limit(2);
  if (owners.length !== 1 || !owners[0]) return null;
  const rows = await database.db
    .select()
    .from(calls)
    .where(eq(calls.creatorId, owners[0].id))
    .orderBy(desc(calls.publishedAt))
    .limit(50);
  const evaluated = options.recheck
    ? await recheckAvailability(await evaluateDue(rows))
    : await evaluateDue(rows);
  const list: PublicCall[] = [];
  for (const row of evaluated) {
    const evidence = callEvidenceSchema.safeParse(row.evidence);
    if (!evidence.success || row.status === "excluded") continue;
    list.push({
      id: row.id,
      postId: row.postId,
      sourceUrl: row.sourceUrl,
      publishedAt: row.publishedAt.toISOString(),
      registeredAt: row.capturedAt.toISOString(),
      status: row.status === "resolved" ? "resolved" : "open",
      evidence: evidence.data,
    });
  }
  const indexed = await indexedBonds(list.map((call) => call.id));
  for (const call of list)
    call.bond = indexed.bonds
      ? (indexed.bonds.get(call.id) ?? null)
      : undefined;
  return publicCallLedgerSchema.parse({
    handle,
    methodology: CALL_METHODOLOGY,
    calls: list,
    bonds: { status: indexed.status, progressBlock: indexed.progressBlock },
    observedAt: new Date().toISOString(),
  });
}
