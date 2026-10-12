import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { NetworkSwitch } from "../../../components/dashboard/network-switch";
import { SourceCall } from "../../../components/dashboard/source-call";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { MarketBooks } from "../../../components/market-books";
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
  // An explicit URL choice wins; otherwise the dashboard switch; else testnet.
  const saved = (await cookies()).get("xt_network")?.value;
  const network =
    params.chainId === undefined
      ? saved === "143"
        ? "143"
        : "10143"
      : (one(params.chainId) ?? "invalid");
  const mainnetEnabled = process.env.KURU_MAINNET_ENABLED === "true";
  const supportedNetwork = network === "10143" || network === "143";
  const mainnet = network === "143";
  const href = (changes: Record<string, string>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") query.set(key, value);
    }
    for (const [key, value] of Object.entries(changes)) query.set(key, value);
    return `/dashboard/trade?${query}`;
  };
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
          !supportedNetwork
            ? "Unsupported network. Select Monad testnet or mainnet."
            : mainnet
              ? perp
                ? "Monad mainnet · real funds. Perpl mainnet trading is not wired yet."
                : "Kuru spot on Monad mainnet · real funds. Market orders spend straight from your wallet with a simulated minimum output; there is no minimum size."
              : perp
                ? "Perpl perpetuals on Monad testnet. Check market, size, leverage and caps before confirming. Perp positions can be liquidated."
                : "Kuru spot on Monad testnet. MON/USDC is the market with both bids and asks. Every swap is simulated, with a minimum output and onchain deadline, before your wallet opens."
        }
      />
      <Suspense fallback={null}>
        <NetworkSwitch />
      </Suspense>
      <nav className="preview-selector" aria-label="Instrument">
        <Link
          href={href({ instrument: "spot" })}
          aria-current={perp ? undefined : "page"}
        >
          Spot · Kuru
        </Link>
        <Link
          href={href({ instrument: "perp" })}
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
      {!supportedNetwork || (mainnet && (perp || !mainnetEnabled)) ? (
        <Panel
          title={
            !supportedNetwork
              ? "Unsupported network"
              : perp
                ? "Perpl mainnet not available"
                : "Mainnet trading is switched off"
          }
          description="No wallet approval or transaction is available here."
        >
          <p>
            {!supportedNetwork
              ? "Choose a supported network above to continue."
              : perp
                ? "Perpl perps run on Monad testnet only in this app. Your selection never falls back to testnet; switch networks above to trade testnet perps."
                : "This server has not enabled Kuru mainnet trading. Your selection never falls back to testnet."}
          </p>
        </Panel>
      ) : mainnet ? (
        <Panel
          title="MON, WETH and cbBTC against USDC · mainnet"
          description="Buying spends USDC (one exact approval, then the order). Selling MON sends native MON with the order. Each step is a separate wallet confirmation."
        >
          <TradeControl chainId={143} />
        </Panel>
      ) : perp ? (
        <Panel
          title="Perpl perpetual order"
          description="Immediate-or-cancel market order with server-enforced leverage and size caps."
        >
          <PerpTradeControl />
        </Panel>
      ) : (
        <Panel
          title="MON, WETH and WBTC against USDC"
          description="Selling MON deposits native MON, then swaps. Buying spends Kuru test USDC. Each step is a separate wallet confirmation. Minimum size is 10 USDC."
        >
          <MarketBooks />
          <TradeControl chainId={10143} />
        </Panel>
      )}
    </>
  );
}
