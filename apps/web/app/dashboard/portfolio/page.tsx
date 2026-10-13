import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { WalletPanelControl } from "../../../components/wallet-panel-control";
export const metadata: Metadata = { title: "Portfolio" };
export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        title="Portfolio"
        description="Your Monad mainnet wallet, balances and recent transactions."
      />
      <Panel title="Your wallet">
        <WalletPanelControl />
      </Panel>
    </>
  );
}
