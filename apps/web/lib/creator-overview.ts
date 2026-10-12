import "server-only";
import { creatorOverviewSchema, normalizeHandle } from "@call-my-bluff/domain";
import { getAddress } from "viem";
import { publicCallLedger } from "./calls";
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
    positionsNote:
      "Creator-specific Perpl positions are unavailable until a creator-owned account is linked. The team account is not this creator's portfolio. Kuru swaps are historical fills, not current holdings or open positions.",
  });
}
