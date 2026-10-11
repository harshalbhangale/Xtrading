import type { Metadata } from "next";
import {
  ConnectionNote,
  PageHeading,
  Panel,
  RecordTable,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        title="Portfolio"
        description="Holdings and returns from confirmed fills only, each linked to the post that prompted it."
      />
      <Panel
        title="Holdings"
        description="Token amounts and valuation are shown separately."
      >
        <RecordTable
          columns={["Asset", "Amount", "Value", "Cost basis", "Data as of"]}
          emptyTitle="No holdings to show."
          emptyDescription="Holdings appear once fill indexing is live."
        />
      </Panel>
      <Panel
        title="Trade history"
        description="Submitted orders are not confirmed fills."
      >
        <RecordTable
          columns={[
            "Market / side",
            "Actual amounts",
            "Fees",
            "Source post",
            "Transaction",
          ]}
          emptyTitle="No confirmed fills to display."
          emptyDescription="Each fill will show its transaction, source post and status."
        />
      </Panel>
      <ConnectionNote>
        Hypothetical creator call outcomes never count as your wallet returns.
      </ConnectionNote>
    </>
  );
}
