import type { Metadata } from "next";
import { ActivityControl } from "../../../components/activity-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { WalletPanelControl } from "../../../components/wallet-panel-control";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        title="Portfolio"
        description="Your Monad mainnet wallet and the swaps it confirmed."
      />
      <Panel title="Wallet">
        <WalletPanelControl />
      </Panel>
      <Panel title="Confirmed fills">
        <ActivityControl view="fills" />
      </Panel>
    </>
  );
}
