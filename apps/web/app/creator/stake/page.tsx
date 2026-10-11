import type { Metadata } from "next";
import {
  ConnectionNote,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";
import { StakeControl } from "../../../components/stake-control";

export const metadata: Metadata = { title: "Creator stake" };

export default function StakePage() {
  return (
    <>
      <PageHeading
        title="Stake"
        description="A refundable deposit with a seven-day withdrawal cooldown. It shows commitment, not accuracy."
      />
      <Panel title="Your stake">
        <StakeControl />
      </Panel>
      <ConnectionNote>
        Nothing is slashed for a wrong call. Staking does not verify identity or
        imply profitability.
      </ConnectionNote>
    </>
  );
}
