import "server-only";
import { calls, creators } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  type CallEvidence,
  callEvidenceSchema,
  callRegistrationSchema,
  normalizeHandle,
  type PublicCall,
  publicCallLedgerSchema,
} from "@call-my-bluff/domain";
import { evaluateExpiredCall } from "@call-my-bluff/integrations/call-evaluation";
import {
  CALL_HORIZONS,
  CALL_METHODOLOGY,
  fetchPublicPost,
  observePrice,
  PRICE_TOLERANCE_SECONDS,
  parsePostUrl,
  postTimestampMs,
  REGISTRATION_WINDOW_SECONDS,
} from "@call-my-bluff/integrations/calls";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDatabase } from "./database";
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

/** Public call ledger for a handle; null when the handle has no unique binding. */
export async function publicCallLedger(input: string) {
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
  const evaluated = await evaluateDue(rows);
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
  return publicCallLedgerSchema.parse({
    handle,
    methodology: CALL_METHODOLOGY,
    calls: list,
    observedAt: new Date().toISOString(),
  });
}
