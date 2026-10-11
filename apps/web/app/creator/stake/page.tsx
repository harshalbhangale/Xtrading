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
        eyebrow="03 / Your stake"
        title="A commitment you can see."
        description="A refundable deposit signals participation. Your trade performance remains a separate record."
      />
      <Panel
        title="Wallet and contract evidence"
        description="Live testnet reads and explicit, separate transaction reviews."
      >
        <StakeControl />
      </Panel>
      <ConnectionNote>
        There is no automatic slashing for a wrong financial call. Staking does
        not verify identity or imply profitability.
      </ConnectionNote>
    </>
  );
}
