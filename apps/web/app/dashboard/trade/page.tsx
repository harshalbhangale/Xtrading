import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { TradeControl } from "../../../components/trade-control";
export const metadata: Metadata = { title: "Trade review" };
export default function TradePage() {
  return (
    <>
      <PageHeading
        eyebrow="Trade review / Kuru spot"
        title="Your decision. Your signature."
        description="Inspect live simulation, exact amounts and approval limits before opening your wallet."
      />
      <Panel
        title="Trade MON / USDC"
        description="Monad testnet only. Each approval and order requires a separate wallet review."
      >
        <TradeControl />
      </Panel>
    </>
  );
}
