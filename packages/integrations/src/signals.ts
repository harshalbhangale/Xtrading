import {
  type PostSignal,
  signalMethodologyVersion,
  type TradeRoute,
} from "@call-my-bluff/domain";
import { hasTokenMention, tokenReferences } from "./token-references";

/** Kuru testnet spot markets, keyed by base asset symbol. Configure explicitly; no fallback. */
// marketId is the trade page's market key. MON/USDC is the liquid native book.
export const kuruSpotAssets: Record<string, { market: string; label: string }> =
  {
    ETH: { market: "WETH", label: "WETH / USDC" },
    BTC: { market: "WBTC", label: "WBTC / USDC" },
    MON: { market: "MON", label: "MON / USDC" },
  };

const names: Record<string, string> = {
  bitcoin: "BTC",
  btc: "BTC",
  ethereum: "ETH",
  eth: "ETH",
  ether: "ETH",
  solana: "SOL",
  sol: "SOL",
  monad: "MON",
  mon: "MON",
  doge: "DOGE",
  dogecoin: "DOGE",
};
const bullish =
  /\b(buy|buying|bought|long(?:ing)?|bullish|moon(?:ing)?|pump(?:ing)?|send(?:ing)? it|accumulat\w*|ape\w*|breakout|higher|load(?:ing)? up|undervalued|bid(?:ding)?|strong|bottom is in)\b|📈|🚀/i;
const bearish =
  /\b(sell|selling|sold|short(?:ing)?|bearish|dump(?:ing)?|top is in|exit(?:ing)?|lower|overvalued|rug\w*|fade|weak|i'?m out|taking profits?)\b|📉/i;
// "go long", "short ETH", perps, futures, leverage or "10x" mean a perp position;
// "long term" / "short-term" / "long run" describe a horizon, not a position.
const perpCue =
  /\b(long|short|longs|shorts|longing|shorting)\b(?![\s-]*(?:term|run)\b)|\b(perps?|perpetuals?|futures|leverage[d]?)\b|\b([1-9][0-9]{0,2})\s?x\b/i;
const tradeCue = /\b(trade|trading|entry|target|tp|sl|stop loss)\b/i;
const horizon =
  /\b(today|tonight|tomorrow|this (?:week|month|year)|next (?:week|month)|eoy|eow|q[1-4]|(?:by|before) (?:end of )?[a-z]+|[0-9]{1,3}\s?(?:h|hrs?|hours?|d|days?|w|weeks?|months?))\b/i;

function findAsset(text: string) {
  const cashtag = text.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/);
  if (cashtag?.[1]) return cashtag[1].toUpperCase();
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? [])
    if (names[word]) return names[word];
  return null;
}

/** Deterministic no-LLM classifier. Conservative: conflicting cues lower confidence. */
export function heuristicSignal(input: {
  postId: string;
  handle: string;
  text: string;
  now?: Date;
}): PostSignal {
  const text = input.text;
  const asset = findAsset(text);
  const up = bullish.test(text),
    down = bearish.test(text);
  const direction = up && !down ? "bullish" : down && !up ? "bearish" : null;
  const perp = perpCue.exec(text);
  const leverageMatch = text.match(/\b([1-9][0-9]{0,2})\s?x\b/i);
  const leverage = leverageMatch?.[1] ? Number(leverageMatch[1]) : null;
  const isCall = Boolean(asset && (direction || tradeCue.test(text)));
  const explicitVerb =
    /\b(buy(?:ing)?|bought|sell(?:ing)?|sold|long(?:ing)?|short(?:ing)?)\b/i.test(
      text,
    );
  const confidence: PostSignal["confidence"] = !isCall
    ? "low"
    : up && down
      ? "low"
      : explicitVerb && /\$[A-Za-z]/.test(text)
        ? "high"
        : "medium";
  const instrument = !isCall ? null : perp ? "perp" : "spot";
  return {
    postId: input.postId,
    handle: input.handle.toLowerCase(),
    isCall,
    confidence,
    asset: isCall ? asset : null,
    direction: isCall ? direction : null,
    instrument,
    leverage:
      instrument === "perp" && leverage && leverage <= 200 ? leverage : null,
    horizon: isCall ? (text.match(horizon)?.[0]?.slice(0, 60) ?? null) : null,
    summary: isCall
      ? `${direction === "bullish" ? "Bullish" : direction === "bearish" ? "Bearish" : "Directionless"} ${instrument} mention of ${asset}${leverage && instrument === "perp" ? ` at ${leverage}x` : ""}.`
      : "No tradable asset with a stated direction or trade intent.",
    source: "heuristic",
    model: null,
    methodologyVersion: signalMethodologyVersion,
    classifiedAt: (input.now ?? new Date()).toISOString(),
    images: [],
    tokenReferences: tokenReferences(text),
    tokenMention: hasTokenMention(text) && tokenReferences(text).length > 0,
  };
}

export type PerplMarketSummary = {
  marketId: number;
  symbol: string;
  open: boolean;
};

/**
 * Route only what the post explicitly says. Bearish language selects a spot sale of owned
 * inventory; a leveraged short requires the post to mention perps/shorts/leverage.
 */
export function deriveTradeRoute(
  signal: PostSignal,
  perplMarkets: PerplMarketSummary[],
): TradeRoute {
  if (signal.tokenReferences.length)
    return {
      status: "unavailable",
      reason:
        "Address reference requires token and network verification. No ticker-based substitute is offered.",
    };
  if (!signal.isCall || !signal.asset)
    return { status: "unavailable", reason: "The post is not a trade call." };
  if (signal.instrument === "perp") {
    const asset = signal.asset;
    const market = perplMarkets.find(
      (item) =>
        item.open &&
        item.symbol
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, " ")
          .split(" ")[0] === asset,
    );
    if (!market)
      return {
        status: "unavailable",
        reason: `No open Perpl testnet market for ${asset}. No spot or venue substitution is made.`,
      };
    return {
      status: "available",
      venue: "Perpl",
      instrument: "perp",
      side:
        signal.direction === "bullish"
          ? "long"
          : signal.direction === "bearish"
            ? "short"
            : null,
      market: market.symbol,
      marketId: String(market.marketId),
      note: "Perp call: leverage, size and collateral are set and confirmed in review.",
    };
  }
  const spot = kuruSpotAssets[signal.asset];
  if (!spot)
    return {
      status: "unavailable",
      reason: `Kuru testnet has no configured ${signal.asset} spot market.`,
    };
  return {
    status: "available",
    venue: "Kuru",
    instrument: "spot",
    side:
      signal.direction === "bullish"
        ? "buy"
        : signal.direction === "bearish"
          ? "sell"
          : null,
    market: spot.label,
    marketId: spot.market,
    note:
      signal.direction === "bearish"
        ? `Spot sell of ${spot.label.split(" ")[0]} you already hold; not a short.`
        : "Spot trade; amounts and slippage are set in review.",
  };
}

/** Guard for model output: a perp classification requires explicit perp language in the post. */
export function mentionsPerp(text: string) {
  return perpCue.test(text);
}

/** Cheap pre-check before calling a model: any cashtag or known asset name. */
export function mentionsAsset(text: string) {
  return findAsset(text) !== null;
}
