import type { Metadata } from "next";
import Link from "next/link";
import { SourceCall } from "../../../components/dashboard/source-call";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { PerpTradeControl } from "../../../components/perp-trade-control";
import { TradeControl } from "../../../components/trade-control";
export const metadata: Metadata = { title: "Trade" };

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
        title="Trade"
        description={
          perp
            ? "Perpl perpetuals on Monad testnet. Check market, size, leverage and caps before confirming. Perp positions can be liquidated."
            : "Kuru spot on Monad testnet. Every swap is simulated against the live market, with a minimum output and onchain deadline set before your wallet opens."
        }
      />
      <nav className="preview-selector" aria-label="Instrument">
        <Link href="/dashboard/trade" aria-current={perp ? undefined : "page"}>
          Spot · Kuru
        </Link>
        <Link
          href="/dashboard/trade?instrument=perp"
          aria-current={perp ? "page" : undefined}
        >
          Perps · Perpl
        </Link>
      </nav>
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
          description="Immediate-or-cancel market order with server-enforced leverage and size caps."
        >
          <PerpTradeControl />
        </Panel>
      ) : (
        <Panel
          title="WETH and WBTC against USDC"
          description="First trade: approve, deposit into your Kuru account, then swap. Each is a separate wallet confirmation."
        >
          <TradeControl />
        </Panel>
      )}
    </>
  );
}
