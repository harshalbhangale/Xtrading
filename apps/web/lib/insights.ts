import "server-only";
import { postSignals } from "@call-my-bluff/database";
import {
  type NansenCheck,
  normalizeHandle,
  type Reputation,
} from "@call-my-bluff/domain";
import { createNansenClient } from "@call-my-bluff/integrations/nansen";
import {
  assessConsistency,
  type WalletTrade,
} from "@call-my-bluff/integrations/signals";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "./database";
import { publicCreatorEvidence } from "./public-creator";

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
      })
      .from(postSignals)
      .where(and(eq(postSignals.handle, handle), eq(postSignals.isCall, true)))
      .orderBy(desc(postSignals.classifiedAt))
      .limit(500);
    return {
      ...empty,
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
