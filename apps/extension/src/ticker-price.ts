import { type SpotPrice, spotPricesSchema } from "@call-my-bluff/domain";
import { el, send, svg } from "./dom";

export type LivePrice = {
  price: string;
  change24hPct: string | null;
  sparkline: string[];
  source: "x" | "kuru-mainnet";
};

/**
 * X renders its own ticker card (name, live price, 24h change, sparkline) for
 * many cashtags. When the post has one for this symbol, read its current
 * values: they are X's live market data, already on screen.
 */
export function readXTicker(
  article: HTMLElement,
  symbol: string,
): LivePrice | null {
  const wanted = symbol.toUpperCase();
  for (const link of article.querySelectorAll<HTMLElement>(
    '[data-testid="ScrollSnap-List"] a[role="link"]',
  )) {
    const texts = [...link.querySelectorAll("span")].map(
      (s) => s.textContent?.trim() ?? "",
    );
    if (!texts.some((t) => t.toUpperCase() === wanted)) continue;
    const price = texts.find((t) => /^\$[0-9,]+(\.[0-9]+)?$/.test(t));
    const change = texts.find((t) => /^[+\-−][0-9.,]+%$/.test(t));
    if (!price) continue;
    return {
      price: price.slice(1).replaceAll(",", ""),
      change24hPct: change
        ? change.replace("−", "-").replace("+", "").replace("%", "")
        : null,
      sparkline: [],
      source: "x",
    };
  }
  return null;
}

let request: Promise<SpotPrice[] | null> | null = null;
let requestedAt = 0;
/** Kuru mainnet last price and 24h change from the app, cached for 30s. */
export function kuruPrice(asset: "MON" | "ETH" | "BTC") {
  if (!request || Date.now() - requestedAt > 30000) {
    requestedAt = Date.now();
    request = send<unknown>({ type: "spot-prices" }).then((raw) => {
      const parsed = spotPricesSchema.safeParse(raw);
      return parsed.success ? parsed.data.prices : null;
    });
  }
  return request.then((prices) => {
    const found = prices?.find((p) => p.asset === asset);
    return found
      ? ({
          price: found.price,
          change24hPct: found.change24hPct,
          sparkline: found.sparkline,
          source: "kuru-mainnet",
        } satisfies LivePrice)
      : null;
  });
}

export function formatPrice(price: string) {
  const value = Number(price);
  if (!Number.isFinite(value)) return `$${price}`;
  return `$${value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 6,
  })}`;
}

export function sparklineSvg(points: string[], up: boolean) {
  const values = points.map(Number).filter(Number.isFinite);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const path = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * 96).toFixed(1)},${(22 - ((v - min) / range) * 20).toFixed(1)}`,
    )
    .join(" ");
  return svg(
    "svg",
    {
      class: `inline-spark ${up ? "up" : "down"}`,
      viewBox: "0 0 96 24",
      width: "96",
      height: "24",
      "aria-hidden": "true",
    },
    svg("polyline", { points: path, fill: "none", "stroke-width": "1.5" }),
  );
}

/** Ticker header line: price, colored 24h change and its source. */
export function priceLine(live: LivePrice | null) {
  if (!live)
    return el("span", { class: "inline-ticker muted" }, "Price unavailable");
  const change = live.change24hPct === null ? null : Number(live.change24hPct);
  return el(
    "span",
    { class: "inline-ticker" },
    el("b", {}, formatPrice(live.price)),
    change === null
      ? null
      : el(
          "em",
          { class: change < 0 ? "down" : "up" },
          `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change).toFixed(2)}%`,
        ),
    el("small", {}, live.source === "x" ? "live on X" : "Kuru mainnet · 24h"),
  );
}
