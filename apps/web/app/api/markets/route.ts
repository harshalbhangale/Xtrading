import { reply } from "../../../lib/identity-http";
import { kuruMarketSnapshot, perplSnapshot } from "../../../lib/markets";
export const dynamic = "force-dynamic";
export async function GET() {
  const [weth, wbtc, perpl] = await Promise.allSettled([
    kuruMarketSnapshot("WETH"),
    kuruMarketSnapshot("WBTC"),
    perplSnapshot(),
  ]);
  return reply({
    chainId: 10143,
    kuru: [weth, wbtc].map((result, index) =>
      result.status === "fulfilled"
        ? result.value.state
        : {
            venue: "Kuru",
            key: index === 0 ? "WETH" : "WBTC",
            status: "unavailable",
          },
    ),
    perpl:
      perpl.status === "fulfilled"
        ? perpl.value
        : { venue: "Perpl", status: "unavailable" },
  });
}
