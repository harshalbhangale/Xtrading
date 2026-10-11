import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { TradeControl } from "../../../components/trade-control";
export const metadata: Metadata = { title: "Trade review" };
export default function TradePage() {
  return (
    <>
      <PageHeading
        title="Trade"
        description="Kuru spot on Monad testnet. Every order is simulated, with exact amounts and approval limits shown before your wallet opens."
      />
      <Panel
        title="Trade MON / USDC"
        description="Each approval and order is a separate wallet confirmation."
      >
        <TradeControl />
      </Panel>
    </>
  );
}
