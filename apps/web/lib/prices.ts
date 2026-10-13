import "server-only";
import { type SpotPrice, spotPricesSchema } from "@call-my-bluff/domain";
import {
  kuruMainnet,
  kuruV1OrderBookAbi,
} from "@call-my-bluff/integrations/kuru";
import { createPublicClient, formatUnits, http } from "viem";
import { monad } from "viem/chains";
import { z } from "zod";

const TTL_MS = 30_000;
let cache: { at: number; value: z.infer<typeof spotPricesSchema> } | null =
  null;

const markets = [
  { asset: "MON", market: kuruMainnet.markets.MON.market },
  { asset: "ETH", market: kuruMainnet.markets.WETH.market },
  { asset: "BTC", market: kuruMainnet.markets.WBTC.market },
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
const HISTORY_TTL_MS = 5 * 60_000;
const FAILED_TTL_MS = 30_000;
const historyCache = new Map<string, { at: number; points: string[] }>();

/**
 * Hourly midpoint of Kuru's own order book for the last 24 hours, read from chain
 * state at past blocks (bestBidAsk). One point per hour; a missing read is dropped,
 * and fewer than twelve points means no chart rather than a guessed one.
 */
async function kuruBookHistory(market: `0x${string}`) {
  const hit = historyCache.get(market);
  if (
    hit &&
    Date.now() - hit.at < (hit.points.length ? HISTORY_TTL_MS : FAILED_TTL_MS)
  )
    return hit.points;
  const client = createPublicClient({
    chain: monad,
    transport: http(
      process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
      {
        timeout: 10_000,
        retryCount: 0,
      },
    ),
  });
  const head = await client.getBlockNumber();
  const [now, earlier] = await Promise.all([
    client.getBlock({ blockNumber: head }),
    client.getBlock({ blockNumber: head - 9000n }),
  ]);
  const secondsPerBlock = Number(now.timestamp - earlier.timestamp) / 9000;
  if (!(secondsPerBlock > 0)) return [];
  const blocksPerHour = Math.round(3600 / secondsPerBlock);
  // Small batches: the public RPC rate-limits bursts of historical reads.
  const blocks = Array.from(
    { length: 25 },
    (_, i) => head - BigInt((24 - i) * blocksPerHour),
  );
  const readAt = (blockNumber: bigint) =>
    client
      .readContract({
        address: market,
        abi: kuruV1OrderBookAbi,
        functionName: "bestBidAsk",
        blockNumber,
      })
      .then(([bid, ask]) =>
        bid > 0n && ask > 0n ? formatUnits((bid + ask) / 2n, 18) : null,
      )
      .catch(() => null);
  const reads: (string | null)[] = [];
  for (let i = 0; i < blocks.length; i += 4)
    reads.push(...(await Promise.all(blocks.slice(i, i + 4).map(readAt))));
  const points = reads.filter((v): v is string => v !== null);
  const value = points.length >= 12 ? points : [];
  historyCache.set(market, { at: Date.now(), points: value });
  return value;
}

/** Plain decimal text; display-only market data is never parsed into amounts. */
function decimal(value: number | string | null | undefined) {
  if (value === null || value === undefined) return null;
  const text = typeof value === "number" ? value.toString() : value.trim();
  return /^-?[0-9]+(\.[0-9]+)?$/.test(text) ? text : null;
}

/**
 * Last traded price and 24h change for our Kuru mainnet markets (Kuru's public
 * market API), with a 24-hour sparkline built from Kuru's on-chain order book
 * midpoint. Kuru has no public candle endpoint; a failed read leaves no sparkline.
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
  // One market at a time: the public RPC rate-limits parallel historical reads.
  const histories = new Map<string, string[]>();
  for (const m of markets)
    histories.set(m.market, await kuruBookHistory(m.market).catch(() => []));
  await Promise.all(
    markets.map(async (m) => {
      const row = rows.find(
        (r) => r.market.toLowerCase() === m.market.toLowerCase(),
      );
      const price = decimal(row?.lastPrice);
      if (!row || !price || price.startsWith("-")) return;
      const sparkline = histories.get(m.market) ?? [];
      const change = decimal(row.priceChange24h);
      prices.push({
        asset: m.asset,
        price,
        change24hPct: change ? Number(change).toFixed(2) : null,
        sparkline,
        source: "kuru-mainnet",
        sparklineSource: sparkline.length ? "kuru-book-1h" : null,
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
