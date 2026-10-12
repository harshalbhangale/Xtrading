import type { PostAvailability } from "@call-my-bluff/domain";
import { z } from "zod";

/**
 * Call registration and pricing for methodology directional-return-v1.
 *
 * Price at time T = open of the first 1-minute candle starting at or after T,
 * within PRICE_TOLERANCE_SECONDS. Prices are integers with PRICE_DECIMALS
 * decimals, truncated toward zero; provider decimals are never parsed as floats.
 */
export const CALL_METHODOLOGY = "directional-return-v1";
export const PRICE_DECIMALS = 8;
export const PRICE_TOLERANCE_SECONDS = 600;
/** A post must be registered within this window after publication. */
export const REGISTRATION_WINDOW_SECONDS = 24 * 3600;
export const CALL_HORIZONS = { "24h": 86400, "7d": 604800, "30d": 2592000 };

export const CALL_ASSETS = {
  BTC: { source: "binance", symbol: "BTCUSDT" },
  ETH: { source: "binance", symbol: "ETHUSDT" },
  SOL: { source: "binance", symbol: "SOLUSDT" },
  // Monad mainnet WMON; Nansen coverage is mainnet, not testnet.
  MON: {
    source: "nansen",
    chain: "monad",
    token: "0x3bd359c1119da7da1d913d1c4d2b7c461115433a",
  },
} as const;
export type CallAsset = keyof typeof CALL_ASSETS;
export const callAssetSchema = z.enum(
  Object.keys(CALL_ASSETS) as [CallAsset, ...CallAsset[]],
);

export function priceSourceId(asset: CallAsset) {
  const config = CALL_ASSETS[asset];
  return config.source === "binance"
    ? `binance-spot-1m-open:${config.symbol}`
    : `nansen-ohlcv-1m-open:${config.chain}:${config.token}`;
}

export type PriceObservation = {
  assetId: CallAsset;
  sourceId: string;
  price: string;
  priceDecimals: number;
  timestamp: string;
};

/** Exact decimal (optionally exponent) text to integer units, truncated toward zero. */
export function decimalToUnits(text: string, decimals: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (!match) throw new Error("Invalid decimal");
  const digits = `${match[1]}${match[2] ?? ""}`;
  const shift = decimals - (match[2]?.length ?? 0) + Number(match[3] ?? 0);
  if (shift >= 0) return BigInt(digits) * 10n ** BigInt(shift);
  const kept = digits.slice(0, digits.length + shift);
  return kept ? BigInt(kept) : 0n;
}

const handlePattern = /^[A-Za-z0-9_]{1,15}$/;
/** Accepts x.com / twitter.com status URLs only. */
export function parsePostUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
      url.hostname,
    )
  )
    return null;
  const match = /^\/([^/]+)\/status\/([0-9]{1,20})\/?$/.exec(url.pathname);
  if (!match?.[1] || !match[2] || !handlePattern.test(match[1])) return null;
  return { handle: match[1].toLowerCase(), postId: match[2] };
}

/** X snowflake IDs embed creation time in milliseconds. */
export function postTimestampMs(postId: string) {
  return (BigInt(postId) >> 22n) + 1288834974657n;
}

const oembedSchema = z.object({
  author_url: z.string(),
  html: z.string().max(20_000),
});
function decodeEntities(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Resolves a public post through X's oEmbed endpoint. The author comes from
 * X's response, not from the URL path, which X ignores.
 */
export async function fetchPublicPost(
  postId: string,
  fetcher: typeof fetch = fetch,
) {
  const target = `https://x.com/i/status/${postId}`;
  const response = await fetcher(
    `https://publish.x.com/oembed?url=${encodeURIComponent(target)}&omit_script=true&dnt=true`,
    { signal: AbortSignal.timeout(10_000), cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`oEmbed failed (${response.status})`);
  const body = oembedSchema.parse(await response.json());
  const author = /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})$/.exec(
    body.author_url,
  )?.[1];
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/.exec(body.html)?.[1];
  if (!author || paragraph === undefined) throw new Error("Unexpected oEmbed");
  return {
    postId,
    authorHandle: author.toLowerCase(),
    text: decodeEntities(paragraph).slice(0, 1000),
  };
}

const binanceSchema = z.array(
  z.tuple([z.number(), z.string()]).rest(z.unknown()),
);

/** Price observation at `timestamp` (unix seconds), or null when unavailable. */
export async function observePrice(
  asset: CallAsset,
  timestamp: number,
  options: { nansenApiKey?: string; fetcher?: typeof fetch } = {},
): Promise<PriceObservation | null> {
  const fetcher = options.fetcher ?? fetch;
  const config = CALL_ASSETS[asset];
  let candle: { start: number; open: string } | undefined;
  if (config.source === "binance") {
    const response = await fetcher(
      `https://data-api.binance.vision/api/v3/klines?symbol=${config.symbol}&interval=1m&startTime=${timestamp * 1000}&limit=1`,
      { signal: AbortSignal.timeout(10_000), cache: "no-store" },
    );
    if (!response.ok) return null;
    const [row] = binanceSchema.parse(await response.json());
    if (row) candle = { start: row[0] / 1000, open: row[1] };
  } else {
    if (!options.nansenApiKey) return null;
    const response = await fetcher(
      "https://api.nansen.ai/api/v1/tgm/token-ohlcv",
      {
        method: "POST",
        headers: {
          apikey: options.nansenApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chain: config.chain,
          token_address: config.token,
          timeframe: "1m",
          date: {
            from: new Date(timestamp * 1000).toISOString(),
            to: new Date(
              (timestamp + PRICE_TOLERANCE_SECONDS + 60) * 1000,
            ).toISOString(),
          },
        }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    candle = firstNansenCandle(await response.text(), timestamp);
  }
  if (!candle) return null;
  if (
    candle.start < timestamp ||
    candle.start > timestamp + PRICE_TOLERANCE_SECONDS
  )
    return null;
  const price = decimalToUnits(candle.open, PRICE_DECIMALS);
  if (price <= 0n) return null;
  return {
    assetId: asset,
    sourceId: priceSourceId(asset),
    price: price.toString(),
    priceDecimals: PRICE_DECIMALS,
    timestamp: String(candle.start),
  };
}

type ReviverContext = { source?: string };
/** Reads candle numbers from their source text so no float rounding occurs. */
export function firstNansenCandle(raw: string, timestamp: number) {
  const parsed = JSON.parse(
    raw,
    (_key, value: unknown, context?: ReviverContext) =>
      typeof value === "number" ? (context?.source ?? null) : value,
  ) as unknown;
  const body = z
    .object({
      data: z.array(
        z.object({ interval_start: z.string(), open: z.string().nullable() }),
      ),
    })
    .safeParse(parsed);
  if (!body.success) return undefined;
  for (const row of body.data.data) {
    const start = Date.parse(row.interval_start) / 1000;
    if (Number.isInteger(start) && start >= timestamp && row.open)
      return { start, open: row.open };
  }
  return undefined;
}

/** Check only public reachability. A missing embed cannot prove a deletion. */
export async function checkPostAvailability(
  postId: string,
  fetcher: typeof fetch = fetch,
): Promise<PostAvailability> {
  if (!/^[0-9]{1,20}$/.test(postId)) throw new Error("Invalid post ID");
  let status: PostAvailability["status"];
  try {
    status = (await fetchPublicPost(postId, fetcher))
      ? "available"
      : "not-publicly-available";
  } catch {
    status = "unavailable";
  }
  return { status, source: "x-oembed", checkedAt: new Date().toISOString() };
}
