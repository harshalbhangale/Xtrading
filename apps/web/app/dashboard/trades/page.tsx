import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { PerpHistoryControl } from "../../../components/perp-history-control";
export const metadata: Metadata = { title: "My trades" };
export default function TradesPage() {
  return (
    <>
      <PageHeading
        title="My trades"
        description="Your Perpl longs and shorts on Monad testnet and mainnet: active positions, history and PnL, read from chain."
      />
      <Panel title="Perpl positions & history">
        <PerpHistoryControl />
      </Panel>
    </>
  );
}
