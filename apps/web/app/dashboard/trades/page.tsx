import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { PerpHistoryControl } from "../../../components/perp-history-control";
export const metadata: Metadata = { title: "My trades" };
export default function TradesPage() {
  return (
    <>
      <PageHeading
        title="My trades"
        description="Your Perpl longs and shorts and Kuru spot trades on Monad testnet and mainnet: open positions, history and PnL, read from chain."
      />
      <Panel title="Positions, history & PnL">
        <PerpHistoryControl />
      </Panel>
    </>
  );
}
