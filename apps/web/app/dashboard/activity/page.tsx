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
        title="Activity"
        description="Account changes, stake events, orders and confirmed fills."
      />
      <Panel title="Events">
        <RecordTable
          columns={["Event", "Status", "Source", "Time", "Receipt"]}
          emptyTitle="No events yet."
          emptyDescription="Your stake history is on the Stake page; trade events appear once fill indexing is live."
        />
      </Panel>
    </>
  );
}
