import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { TradeControl } from "../../../components/trade-control";
export const metadata: Metadata = { title: "Trade review" };
export default function TradePage() {
  return (
    <>
      <PageHeading
        title="Trade"
        description="Kuru spot on Monad testnet. Every swap is simulated against the live market, with a minimum output and onchain deadline set before your wallet opens."
      />
      <Panel
        title="WETH and WBTC against USDC"
        description="First trade: approve, deposit into your Kuru account, then swap. Each is a separate wallet confirmation."
      >
        <TradeControl />
      </Panel>
    </>
  );
}
