import { getMonadChain, kuruMarkets } from "@call-my-bluff/integrations";
import type { Metadata } from "next";
import { TradeTicket } from "../../../components/dashboard/trade-ticket";
import {
  ConnectionNote,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Trade review" };

export default function TradePage() {
  const chain = getMonadChain(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID);
  const market = kuruMarkets[chain.id][0];
  if (!market) throw new Error("No configured market reference");
  return (
    <>
      <PageHeading
        eyebrow="Trade review / Kuru spot"
        title="Your decision. Your signature."
        description="Review the venue and exact quote before your wallet is asked to approve anything."
      />
      <div className="dashboard-two-column">
        <Panel
          title="Prepare a spot trade"
          description="The quote provider and execution flow are not connected yet."
        >
          <TradeTicket
            marketName={market.name}
            marketAddress={market.address}
            chainName={chain.name}
          />
        </Panel>
        <Panel
          title="Before you approve"
          description="A real quote will make these values inspectable."
        >
          <dl className="quote-review">
            {[
              "Expected output",
              "Minimum received",
              "Trading fees",
              "Network fee estimate",
              "Quote expiry",
              "Token approval limit",
              "Source post",
            ].map((label) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>Unavailable</dd>
              </div>
            ))}
          </dl>
          <button className="button" type="button" disabled>
            Wallet review unavailable
          </button>
          <p className="small-note">
            Preparing a quote does not submit an order. A submitted order is not
            a confirmed fill.
          </p>
        </Panel>
      </div>
      <ConnectionNote>
        No transaction can be prepared or signed from this screen yet. Execution
        requires a live quote, supported-market validation and your explicit
        wallet approval.
      </ConnectionNote>
    </>
  );
}
