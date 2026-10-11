import type { Metadata } from "next";
import { SourceCall } from "../../../components/dashboard/source-call";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { PerpTradeControl } from "../../../components/perp-trade-control";
import { TradeControl } from "../../../components/trade-control";
export const metadata: Metadata = { title: "Trade review" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const perp = one(params.instrument) === "perp";
  const handle = one(params.handle),
    postId = one(params.postId);
  const asset = one(params.asset)?.toUpperCase() ?? null;
  const direction = one(params.direction);
  return (
    <>
      <PageHeading
        eyebrow={
          perp ? "Trade review / Perpl perp" : "Trade review / Kuru spot"
        }
        title="Your decision. Your signature."
        description={
          perp
            ? "Inspect market, size, leverage and caps before confirming. Perp orders can be liquidated."
            : "Inspect live simulation, exact amounts and approval limits before opening your wallet."
        }
      />
      {handle && postId && (
        <SourceCall
          handle={handle}
          postId={postId}
          asset={asset && /^[A-Z0-9]{1,12}$/.test(asset) ? asset : null}
          direction={
            direction === "bullish" || direction === "bearish"
              ? direction
              : null
          }
        />
      )}
      {perp ? (
        <Panel
          title="Perpl perpetual order"
          description="Monad testnet. Immediate-or-cancel market order with server-enforced leverage and size caps."
        >
          <PerpTradeControl />
        </Panel>
      ) : (
        <Panel
          title="Trade MON / USDC"
          description="Monad testnet only. Each approval and order requires a separate wallet review."
        >
          <TradeControl />
        </Panel>
      )}
    </>
  );
}
