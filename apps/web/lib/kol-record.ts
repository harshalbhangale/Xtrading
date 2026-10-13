import "server-only";
import { assessKol, normalizeHandle } from "@call-my-bluff/domain";
import { getAddress } from "viem";
import { publicCallLedger } from "./calls";
import { deletionReport, mergeCallAvailability } from "./deletions";
import { walletActivity } from "./fill-indexing";
import { capturedTokenRisks } from "./insights";
import { publicCreatorEvidence } from "./public-creator";

/**
 * A creator's reputation tier and accountability flags from held evidence:
 * registered calls (optionally re-checking post availability) and the bound wallet's indexed Kuru swaps.
 */
export async function kolRecord(
  input: string,
  options: { recheck?: boolean } = {},
) {
  const handle = normalizeHandle(input);
  if (!handle) return null;
  const evidence = await publicCreatorEvidence(handle).catch(() => null);
  const wallet =
    evidence?.identity.status === "bound" ? evidence.identity.wallet : null;
  const [ledger, activity, availability, tokens] = await Promise.all([
    publicCallLedger(handle, options).catch(() => null),
    wallet ? walletActivity(getAddress(wallet)).catch(() => null) : null,
    // Use persisted checks; displaying a count must not initiate an X/provider sweep.
    deletionReport({ handle, since: new Date(0), sweep: false }).catch(
      () => null,
    ),
    // Stored Nansen verdicts; the full record page may check one new post.
    capturedTokenRisks(handle, { checkMissing: options.recheck }).catch(() => ({
      risky: [],
      unverified: [],
    })),
  ]);
  const removed = (
    availability?.creators.find((c) => c.handle === handle)?.posts ?? []
  )
    .filter((p) => p.status === "removed")
    .map((p) => ({ postId: p.postId, asset: p.asset }));
  // Registered calls count too: a deleted registered call is the worst case.
  const totals = availability
    ? mergeCallAvailability(
        availability.totals,
        new Set(availability.indexedPostIds),
        (ledger?.calls ?? []).map((call) => ({
          postId: call.postId,
          availability: call.evidence.availability,
        })),
      )
    : null;
  const swaps =
    activity && activity.status !== "unavailable" ? activity.swaps : [];
  return {
    handle,
    bound: Boolean(wallet),
    postAvailability:
      availability && totals
        ? {
            indexed: totals.indexed,
            checked: totals.checked,
            missing: totals.removed,
            suspected: totals.suspected,
            observedAt: availability.observedAt,
          }
        : null,
    ledger,
    swapsStatus: wallet ? (activity?.status ?? "unavailable") : "unbound",
    assessment: assessKol({
      calls: ledger?.calls ?? [],
      swaps,
      captured: {
        removed,
        riskyTokens: tokens.risky,
        unverifiedTokens: tokens.unverified,
      },
    }),
    observedAt: new Date().toISOString(),
  };
}
