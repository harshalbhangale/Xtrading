import { kuruMarketKeys } from "@call-my-bluff/integrations/kuru";
import { formatUnits } from "viem";
import { kuruMarketSnapshot } from "../lib/markets";

function bookPrice(raw: string | null, precision: string) {
  if (!raw) return null;
  return formatUnits(BigInt(raw), precision.length - 1);
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
      ? { ...row.value, unavailable: false }
      : {
          key,
          bestBid: null,
          bestAsk: null,
          pricePrecision: "1",
          unavailable: true,
        };
  });
}

// Best bid/ask read from the Kuru books at request time. Unfinalized reads.
export async function MarketBooks() {
  let books: Awaited<ReturnType<typeof liveBooks>> = [];
  try {
    books = await liveBooks();
  } catch {
    books = [];
  }
  if (books.length === 0)
    return <p className="small-note">Live order books are unavailable.</p>;
  return (
    <>
      <div className="market-list">
        {books.map((book) => {
          const bid = bookPrice(book.bestBid, book.pricePrecision);
          const ask = bookPrice(book.bestAsk, book.pricePrecision);
          return (
            <div className="market-row" key={book.key}>
              <div className="market-name">
                <strong>{book.key}/USDC</strong>
                <span>
                  {book.unavailable
                    ? "Book unavailable"
                    : ask
                      ? "Kuru spot"
                      : "No asks · buys cannot fill"}
                </span>
              </div>
              <div className="market-quote" data-side="bid" data-empty={!bid}>
                <span>Best bid</span>
                {bid ?? "—"}
              </div>
              <div className="market-quote" data-side="ask" data-empty={!ask}>
                <span>Best ask</span>
                {ask ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
      <p className="small-note">
        Prices in USDC, read live from the chain and not yet final.
      </p>
    </>
  );
}
