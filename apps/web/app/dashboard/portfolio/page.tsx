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
        description="Swaps your wallet confirmed, with the transaction and the post that prompted it. Balances stay on the trade screen."
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
