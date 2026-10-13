import "server-only";
import { assessKol, normalizeHandle } from "@call-my-bluff/domain";
import { getAddress } from "viem";
import { publicCallLedger } from "./calls";
import { deletionReport, mergeCallAvailability } from "./deletions";
import { walletActivity } from "./fill-indexing";
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
  const [ledger, activity, availability] = await Promise.all([
    publicCallLedger(handle, options).catch(() => null),
    wallet ? walletActivity(getAddress(wallet)).catch(() => null) : null,
    // Use persisted checks; displaying a count must not initiate an X/provider sweep.
    deletionReport({ handle, since: new Date(0), sweep: false }).catch(
      () => null,
    ),
  ]);
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
    assessment: assessKol({ calls: ledger?.calls ?? [], swaps }),
    observedAt: new Date().toISOString(),
  };
}
