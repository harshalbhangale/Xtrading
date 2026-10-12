import "server-only";
import { tradeIntents } from "@call-my-bluff/database";
import { creatorOverviewSchema, normalizeHandle } from "@call-my-bluff/domain";
import { and, eq, inArray } from "drizzle-orm";
import { getAddress } from "viem";
import { publicCallLedger } from "./calls";
import { getDatabase } from "./database";
import { detectedPosts } from "./detected-posts";
import { walletActivity } from "./fill-indexing";
import { publicCreatorEvidence } from "./public-creator";

export async function creatorOverview(input: string) {
  const handle = normalizeHandle(input);
  if (!handle) return null;
  const evidence = await publicCreatorEvidence(handle).catch(() => null);
  const wallet =
    evidence?.identity.status === "bound" ? evidence.identity.wallet : null;
  const [ledger, activity, detected] = await Promise.all([
    publicCallLedger(handle).catch(() => null),
    wallet
      ? walletActivity(getAddress(wallet)).catch(() => null)
      : Promise.resolve(null),
    detectedPosts(handle).catch(() => null),
  ]);
  const postIds = [
    ...new Set([
      ...(ledger?.calls.map((call) => call.postId) ?? []),
      ...(detected?.map((post) => post.signal.postId) ?? []),
    ]),
  ];
  const followerTrades = await tradesFromPosts(postIds).catch(() => null);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const open = ledger?.calls.filter((call) => call.status === "open") ?? [];
  return creatorOverviewSchema.parse({
    handle,
    observedAt: new Date().toISOString(),
    callsStatus: ledger ? "ready" : wallet ? "unavailable" : "untracked",
    ongoingCalls: open.filter(
      (call) => BigInt(call.evidence.terms.expiry) > now,
    ),
    expiredUnresolved: open.filter(
      (call) => BigInt(call.evidence.terms.expiry) <= now,
    ).length,
    activity,
    detectedPosts: detected ?? [],
    detectedPostsStatus: detected ? "ready" : "unavailable",
    followerTrades: followerTrades ?? {
      status: "unavailable",
      recorded: 0,
      submitted: 0,
      posts: 0,
    },
    positionsNote:
      "Creator-specific Perpl positions are unavailable until a creator-owned account is linked. The team account is not this creator's portfolio. Kuru swaps are historical fills, not current holdings or open positions.",
  });
}

/** Count trades users recorded against these posts on testnet. Counts only; no PnL. */
async function tradesFromPosts(postIds: string[]) {
  const database = getDatabase();
  if (!database) return null;
  if (!postIds.length)
    return { status: "ready" as const, recorded: 0, submitted: 0, posts: 0 };
  const rows = await database.db
    .select({
      post: tradeIntents.sourcePostId,
      hash: tradeIntents.transactionHash,
    })
    .from(tradeIntents)
    .where(
      and(
        eq(tradeIntents.chainId, 10143),
        inArray(tradeIntents.sourcePostId, postIds),
      ),
    );
  return {
    status: "ready" as const,
    recorded: rows.length,
    submitted: rows.filter((row) => row.hash).length,
    posts: new Set(rows.map((row) => row.post)).size,
  };
}
