import type { Metadata } from "next";
import {
  ConnectionNote,
  MetricCard,
  PageHeading,
  Panel,
  RecordTable,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        eyebrow="03 / Portfolio"
        title="Your trades. Their story."
        description="Holdings and returns grounded in confirmed execution, with the posts that brought you here."
      />
      <div className="metric-grid">
        <MetricCard
          label="Portfolio value"
          detail="Price and holdings data unavailable"
        />
        <MetricCard
          label="Realized P&L"
          detail="Confirmed fills and cost basis required"
        />
        <MetricCard label="Trading fees" detail="No indexed fee records yet" />
        <MetricCard
          label="Open orders"
          detail="Order status source not connected"
        />
      </div>
      <Panel
        title="Holdings"
        description="Token amounts and valuation are shown separately."
      >
        <RecordTable
          columns={["Asset", "Amount", "Value", "Cost basis", "Data as of"]}
          emptyTitle="Your positions belong here."
          emptyDescription="Confirmed holdings will appear when your wallet and indexer are connected."
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
          emptyDescription="Each fill will include its transaction, source post and settlement status."
        />
      </Panel>
      <ConnectionNote>
        Hypothetical creator call outcomes never count as your wallet returns.
      </ConnectionNote>
    </>
  );
}
