import "server-only";
import { createHash } from "node:crypto";
import { postSignals } from "@call-my-bluff/database";
import {
  type PostSignal,
  type PostSignalRequest,
  postSignalSchema,
} from "@call-my-bluff/domain";
import {
  deriveTradeRoute,
  heuristicSignal,
  mentionsAsset,
  type PerplMarketSummary,
} from "@call-my-bluff/integrations/signals";
import {
  hasTokenMention,
  tokenReferences,
} from "@call-my-bluff/integrations/token-references";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "./database";
import { classifyWithLlm, llmMode } from "./llm";
import { perplSnapshot } from "./markets";
import { allow } from "./rate-limit";

const cache = new Map<string, { expires: number; signal: PostSignal }>();
let perplCache: { expires: number; markets: PerplMarketSummary[] } | undefined;

async function perplMarkets() {
  if (perplCache && perplCache.expires > Date.now()) return perplCache.markets;
  try {
    const snapshot = await perplSnapshot();
    perplCache = {
      expires: Date.now() + 60_000,
      markets: snapshot.markets.map((m) => ({
        marketId: m.marketId,
        symbol: m.symbol,
        open: m.open,
      })),
    };
  } catch {
    // Discovery outage: no perp routes rather than stale or guessed markets.
    perplCache = { expires: Date.now() + 15_000, markets: [] };
  }
  return perplCache.markets;
}

async function stored(postId: string, textHash: string) {
  const database = getDatabase();
  if (!database) return null;
  try {
    const rows = await database.db
      .select({ signal: postSignals.signal, textHash: postSignals.textHash })
      .from(postSignals)
      .where(eq(postSignals.postId, postId))
      .limit(1);
    const row = rows[0];
    if (!row || row.textHash !== textHash) return null;
    const parsed = postSignalSchema.safeParse(row.signal);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function persist(signal: PostSignal, textHash: string) {
  const database = getDatabase();
  if (!database || (!signal.isCall && !signal.tokenMention)) return;
  try {
    await database.db
      .insert(postSignals)
      .values({
        postId: signal.postId,
        handle: signal.handle,
        textHash,
        isCall: signal.isCall,
        asset: signal.asset,
        direction: signal.direction,
        instrument: signal.instrument,
        signal,
        source: signal.source,
        methodologyVersion: signal.methodologyVersion,
        classifiedAt: new Date(signal.classifiedAt),
      })
      // First classification wins; an edited post with new text is re-keyed by hash on read.
      .onConflictDoNothing();
    // Enrich the same captured text with image metadata; never replace changed text.
    if (signal.images.length)
      await database.db
        .update(postSignals)
        .set({ signal })
        .where(
          and(
            eq(postSignals.postId, signal.postId),
            eq(postSignals.textHash, textHash),
          ),
        );
  } catch {
    // Persistence is best-effort; the response still reflects this classification.
  }
}

export async function classifyPost(input: PostSignalRequest) {
  const textHash = createHash("sha256").update(input.text).digest("hex");
  const key = `${input.postId}:${textHash}`;
  const hit = cache.get(key);
  let signal =
    hit && hit.expires > Date.now()
      ? hit.signal
      : await stored(input.postId, textHash);
  if (!signal) {
    const baseline = heuristicSignal(input);
    // Skip the model when there is no asset or trade cue at all; nothing could be routed.
    const worthModel =
      baseline.isCall ||
      mentionsAsset(input.text) ||
      /\b(long|short|buy|sell)\b/i.test(input.text);
    const modelled =
      worthModel && allow("llm:global", 120)
        ? await classifyWithLlm(input)
        : null;
    signal = modelled ?? baseline;
  }
  signal = {
    ...signal,
    images: input.images.length ? input.images : signal.images,
    tokenReferences: tokenReferences(input.text),
    tokenMention:
      hasTokenMention(input.text) && tokenReferences(input.text).length > 0,
  };
  await persist(signal, textHash);
  if (cache.size >= 2000) cache.clear();
  cache.set(key, { expires: Date.now() + 3_600_000, signal });
  return {
    signal,
    route: deriveTradeRoute(signal, await perplMarkets()),
    llm: llmMode(),
  };
}
