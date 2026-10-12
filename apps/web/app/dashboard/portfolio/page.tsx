import type { Metadata } from "next";
import { ActivityControl } from "../../../components/activity-control";
import {
  ConnectionNote,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        title="Portfolio"
        description="Your confirmed Kuru fills, each linked to its transaction and the post that prompted it. Current balances are on the Trade page."
      />
      <Panel title="Confirmed fills">
        <ActivityControl view="fills" />
      </Panel>
      <ConnectionNote>
        Hypothetical creator call outcomes never count as your wallet returns.
      </ConnectionNote>
    </>
  );
}
