import "server-only";
import { assessKol, normalizeHandle } from "@call-my-bluff/domain";
import { getAddress } from "viem";
import { publicCallLedger } from "./calls";
import { walletActivity } from "./fill-indexing";
import { publicCreatorEvidence } from "./public-creator";

/**
 * A creator's reputation tier and accountability flags from held evidence:
 * registered calls (optionally re-checking post availability), bond outcomes
 * and the bound wallet's indexed Kuru swaps.
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
  const [ledger, activity] = await Promise.all([
    publicCallLedger(handle, options).catch(() => null),
    wallet ? walletActivity(getAddress(wallet)).catch(() => null) : null,
  ]);
  const swaps =
    activity && activity.status !== "unavailable" ? activity.swaps : [];
  return {
    handle,
    bound: Boolean(wallet),
    ledger,
    swapsStatus: wallet ? (activity?.status ?? "unavailable") : "unbound",
    assessment: assessKol({ calls: ledger?.calls ?? [], swaps }),
    observedAt: new Date().toISOString(),
  };
}
