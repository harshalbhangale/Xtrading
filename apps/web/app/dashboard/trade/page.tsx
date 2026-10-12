import { kuruMarketKeys } from "@call-my-bluff/integrations/kuru";
import type { Metadata } from "next";
import Link from "next/link";
import { formatUnits } from "viem";
import { SourceCall } from "../../../components/dashboard/source-call";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { PerpTradeControl } from "../../../components/perp-trade-control";
import { TradeControl } from "../../../components/trade-control";
import { kuruMarketSnapshot } from "../../../lib/markets";
export const metadata: Metadata = { title: "Trade" };

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
}

function bookPrice(raw: string | null, precision: string) {
  if (!raw) return "none";
  return `${formatUnits(BigInt(raw), precision.length - 1)} USDC`;
}

async function liveBooks() {
  const rows = await Promise.allSettled(
    kuruMarketKeys.map(async (key) => {
      const { state } = await kuruMarketSnapshot(key);
      return state;
    }),
  );
  return kuruMarketKeys.map((key, index) => {
    const row = rows[index];
    return row?.status === "fulfilled"
      ? row.value
      : {
          key,
          bestBid: null,
          bestAsk: null,
          pricePrecision: "1",
          unavailable: true,
        };
  });
}

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const network =
    params.chainId === undefined ? "10143" : (one(params.chainId) ?? "invalid");
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
              ? "Monad mainnet · real funds. Trading is unavailable until the mainnet integration is validated."
              : perp
                ? "Perpl perpetuals on Monad testnet. Check market, size, leverage and caps before confirming. Perp positions can be liquidated."
                : "Kuru spot on Monad testnet. MON/USDC is the market with both bids and asks. Every swap is simulated, with a minimum output and onchain deadline, before your wallet opens."
        }
      />
      <nav className="preview-selector" aria-label="Network">
        <Link
          href={href({ chainId: "10143" })}
          aria-current={network === "10143" ? "page" : undefined}
        >
          Testnet · 10143
        </Link>
        <Link
          href={href({ chainId: "143" })}
          aria-current={mainnet ? "page" : undefined}
        >
          Mainnet · 143
        </Link>
      </nav>
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
      {!supportedNetwork || mainnet ? (
        <Panel
          title={mainnet ? "Mainnet trading not ready" : "Unsupported network"}
          description="No wallet approval or transaction is available on this network."
        >
          <p>
            {mainnet
              ? "The current Kuru and Perpl adapters use Monad testnet contracts. Mainnet requires separate market configuration and execution validation. Your selection will never fall back to testnet."
              : "Choose a supported network above to continue."}
          </p>
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
          <BookStrip />
          <TradeControl />
        </Panel>
      )}
    </>
  );
}

async function BookStrip() {
  let books: Awaited<ReturnType<typeof liveBooks>> = [];
  try {
    books = await liveBooks();
  } catch {
    books = [];
  }
  if (books.length === 0)
    return <p className="small-note">Live book unavailable.</p>;
  return (
    <p className="small-note">
      Live book, unfinalized.{" "}
      {books.map((book) => (
        <span key={book.key}>
          {book.key} bid {bookPrice(book.bestBid, book.pricePrecision)}
          {" · "}
          ask {bookPrice(book.bestAsk, book.pricePrecision)}
          {". "}
        </span>
      ))}
      An empty ask means a buy cannot fill.
    </p>
  );
}
