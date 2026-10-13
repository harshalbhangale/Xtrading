import "server-only";
import { type SpotPrice, spotPricesSchema } from "@call-my-bluff/domain";
import { kuruMainnet } from "@call-my-bluff/integrations/kuru";
import { z } from "zod";

const TTL_MS = 30_000;
let cache: { at: number; value: z.infer<typeof spotPricesSchema> } | null =
  null;

const markets = [
  { asset: "MON", market: kuruMainnet.markets.MON.market, binance: null },
  { asset: "ETH", market: kuruMainnet.markets.WETH.market, binance: "ETHUSDT" },
  { asset: "BTC", market: kuruMainnet.markets.WBTC.market, binance: "BTCUSDT" },
] as const;

const kuruMarkets = z.object({
  data: z.object({
    data: z.array(
      z.object({
        market: z.string(),
        lastPrice: z.union([z.number(), z.string()]).nullable().optional(),
        priceChange24h: z.union([z.number(), z.string()]).nullable().optional(),
        lastTradeTime: z.string().nullable().optional(),
      }),
    ),
  }),
});
const klines = z.array(z.tuple([z.number(), z.string()]).rest(z.unknown()));

/** Plain decimal text; display-only market data is never parsed into amounts. */
function decimal(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const text = typeof value === "number" ? value.toString() : value.trim();
  return /^-?[0-9]+(\.[0-9]+)?$/.test(text) ? text : null;
}

/**
 * Last traded price and 24h change for our Kuru mainnet markets (Kuru's public
 * market API), with a 24-hour Binance 1h sparkline for ETH and BTC. Kuru has no
 * public candle endpoint, so MON carries no sparkline rather than an invented one.
 */
export async function spotPrices() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const response = await fetch(
    "https://api.kuru.io/api/v1/markets?status=active&limit=500",
    { cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) throw new Error("kuru_unavailable");
  const rows = kuruMarkets.parse(await response.json()).data.data;
  const prices: SpotPrice[] = [];
  await Promise.all(
    markets.map(async (m) => {
      const row = rows.find(
        (r) => r.market.toLowerCase() === m.market.toLowerCase(),
      );
      const price = decimal(row?.lastPrice);
      if (!row || !price || price.startsWith("-")) return;
      let sparkline: string[] = [];
      if (m.binance) {
        const k = await fetch(
          `https://data-api.binance.vision/api/v3/klines?symbol=${m.binance}&interval=1h&limit=24`,
          { cache: "no-store", signal: AbortSignal.timeout(6000) },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        const parsed = klines.safeParse(k);
        // Close price is the 5th field; keep provider decimal text as-is.
        if (parsed.success)
          sparkline = parsed.data
            .map((row) => decimal(row[4] as string))
            .filter((v): v is string => Boolean(v));
      }
      const change = decimal(row.priceChange24h);
      prices.push({
        asset: m.asset,
        price,
        change24hPct: change ? Number(change).toFixed(2) : null,
        sparkline,
        source: "kuru-mainnet",
        sparklineSource: sparkline.length ? "binance-1h" : null,
        lastTradeAt:
          row.lastTradeTime && !Number.isNaN(Date.parse(row.lastTradeTime))
            ? new Date(row.lastTradeTime).toISOString()
            : null,
      });
    }),
  );
  const value = spotPricesSchema.parse({
    prices: prices.sort((a, b) => a.asset.localeCompare(b.asset)),
    observedAt: new Date().toISOString(),
  });
  cache = { at: Date.now(), value };
  return value;
}
