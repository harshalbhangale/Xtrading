import type { Metadata } from "next";
import { ActivityControl } from "../../../components/activity-control";
import {
  ConnectionNote,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";
import { WalletPanelControl } from "../../../components/wallet-panel-control";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeading
        title="Portfolio"
        description="Swaps your wallet confirmed, with the transaction and the post that prompted it. Deposit to your wallet by QR code and send to any address."
      />
      <Panel title="Wallet">
        <WalletPanelControl />
      </Panel>
      <Panel title="Confirmed fills">
        <ActivityControl view="fills" />
      </Panel>
      <ConnectionNote>
        Hypothetical creator call outcomes never count as your wallet returns.
      </ConnectionNote>
    </>
  );
}
