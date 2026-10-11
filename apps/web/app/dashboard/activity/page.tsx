import type { Metadata } from "next";
import {
  PageHeading,
  Panel,
  RecordTable,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeading
        eyebrow="04 / Activity"
        title="Every action. A receipt."
        description="A timeline for account changes, stake events, orders and confirmed fills."
      />
      <Panel
        title="Activity ledger"
        description="Events will retain their chain, timestamp and transaction reference."
      >
        <RecordTable
          columns={["Event", "Status", "Source", "Time", "Receipt"]}
          emptyTitle="Nothing indexed yet."
          emptyDescription="Your timeline will populate from verified account changes and confirmed onchain activity."
        />
      </Panel>
    </>
  );
}
