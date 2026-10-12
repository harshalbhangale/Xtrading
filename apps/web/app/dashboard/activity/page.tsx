import type { Metadata } from "next";
import { ActivityControl } from "../../../components/activity-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeading
        title="Activity"
        description="Kuru swaps, deposits and withdrawals from your wallet, as indexed by Envio. Stake history is on the creator Stake page."
      />
      <Panel title="Events">
        <ActivityControl view="all" />
      </Panel>
    </>
  );
}
