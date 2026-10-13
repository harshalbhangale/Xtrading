import type { Metadata } from "next";
import { ActivityControl } from "../../../components/activity-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { MainnetTradesControl } from "../../../components/mainnet-trades-control";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <>
      <PageHeading
        title="Activity"
        description="Testnet Kuru swaps, deposits and withdrawals from your wallet, as indexed by Envio."
      />
      <Panel title="Events">
        <ActivityControl view="all" />
      </Panel>
      <Panel title="Mainnet trades">
        <MainnetTradesControl />
      </Panel>
    </>
  );
}
