import { spotPrices } from "../../../../lib/prices";

export const dynamic = "force-dynamic";
// Cold reads fetch 25 historical order-book snapshots per market.
export const maxDuration = 30;
/** Public display prices (Kuru mainnet last trade + 24h change). */
export async function GET() {
  try {
    return Response.json(await spotPrices(), {
      headers: { "Cache-Control": "public, max-age=15, s-maxage=30" },
    });
  } catch {
    return Response.json(
      { error: "prices_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
