import type { Metadata } from "next";
import {
  ConnectionNote,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";
import { StakeControl } from "../../../components/stake-control";

export const metadata: Metadata = { title: "Previous deposit recovery" };

export default function StakePage() {
  return (
    <>
      <PageHeading
        title="Previous deposit recovery"
        description="Staking has been retired. This page only supports recovering funds deposited previously."
      />
      <Panel title="Withdraw an existing deposit">
        <StakeControl />
      </Panel>
      <ConnectionNote>
        Existing contracts and withdrawal rights remain available. No deposit is
        needed to create calls or trade.
      </ConnectionNote>
    </>
  );
}
