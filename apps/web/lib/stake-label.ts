import type { PublicCreatorEvidence } from "@call-my-bluff/domain";
import { formatUnits } from "viem";

export function stakeLabel(stake: PublicCreatorEvidence["stake"]) {
  if (stake.status === "active" && stake.balance)
    return `${formatUnits(BigInt(stake.balance), 6)} ${stake.symbol} active`;
  if (stake.status === "withdrawal-pending") return "Withdrawal pending";
  if (stake.status === "inactive") return "Below minimum";
  return "Unavailable";
}
