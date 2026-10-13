import type { TradeRoute } from "@call-my-bluff/domain";
import { shadowHost } from "./dom";
import { attachedTrade, type InlinePost } from "./inline-trade";

/** X cashtag symbols we can trade on Kuru, mapped to our market keys. */
const markets = {
  ETH: { market: "WETH", asset: "ETH" },
  WETH: { market: "WETH", asset: "ETH" },
  BTC: { market: "WBTC", asset: "BTC" },
  WBTC: { market: "WBTC", asset: "BTC" },
  CBBTC: { market: "WBTC", asset: "BTC" },
  MON: { market: "MON", asset: "MON" },
} as const;
type Supported = keyof typeof markets;

export type XTickerCard = {
  link: HTMLElement;
  container: HTMLElement;
  symbol: Supported;
  market: (typeof markets)[Supported]["market"];
  asset: (typeof markets)[Supported]["asset"];
};

/**
 * X renders a ticker card (name, live price, 24h change, sparkline) inside a
 * ScrollSnap carousel for many cashtags. Returns the first card in the post
 * for an asset we can trade, or null. No classification is involved.
 */
export function findXTicker(article: HTMLElement): XTickerCard | null {
  for (const list of article.querySelectorAll<HTMLElement>(
    '[data-testid="ScrollSnap-List"]',
  )) {
    const container = list.closest("nav")?.parentElement;
    if (!container) continue;
    for (const link of list.querySelectorAll<HTMLElement>('a[role="link"]')) {
      const texts = [...link.querySelectorAll("span")].map(
        (s) => s.textContent?.trim() ?? "",
      );
      if (!texts.some((t) => /^\$[0-9,]+(\.[0-9]+)?$/.test(t))) continue;
      const symbol = texts
        .map((t) => t.toUpperCase())
        .find((t): t is Supported => t in markets);
      if (!symbol) continue;
      return { link, container, symbol, ...markets[symbol] };
    }
  }
  return null;
}

/** Deepest-first flex row that holds X's sparkline; the Buy button joins it. */
function cardRow(link: HTMLElement) {
  const rows = [...link.querySelectorAll<HTMLElement>("div")].filter((d) => {
    const style = getComputedStyle(d);
    return (
      style.display.includes("flex") &&
      !style.flexDirection.startsWith("column") &&
      d.querySelector("svg")
    );
  });
  return rows[0] ?? link;
}

const route = (card: XTickerCard): TradeRoute => ({
  status: "available",
  venue: "Kuru",
  instrument: "spot",
  side: null,
  market: `${card.market}/USDC`,
  marketId: card.market,
  note: "From X's ticker card; no call classification involved.",
});

/**
 * Puts an Xtrading Buy button inside X's ticker card and our trade panel
 * directly beneath the card, aligned to its width. Idempotent per card.
 */
export function attachToXTicker(
  article: HTMLElement,
  post: { postId: string; handle: string },
) {
  const card = findXTicker(article);
  if (!card) return false;
  const existing = card.container.nextElementSibling as HTMLElement | null;
  if (existing?.classList.contains("cmb-xticker-host")) {
    // X re-renders card contents; restore the button if it was dropped.
    if (!card.link.querySelector(".cmb-xbuy-host"))
      existing.dispatchEvent(new Event("cmb:rebutton"));
    return true;
  }
  const input: InlinePost = {
    postId: post.postId,
    handle: post.handle,
    asset: card.asset,
    direction: null,
    instrument: "spot",
    tokenReferences: [],
  };
  const { panel, buy } = attachedTrade(input, route(card));
  const { host, root } = shadowHost("cmb-xticker-host");
  host.dataset.postId = post.postId;
  host.dataset.market = card.market;
  root.append(panel);
  panel.dataset.mounted = "true";
  host.addEventListener("click", (event) => event.stopPropagation());
  host.style.display = "block";
  card.container.after(host);

  const mountButton = () => {
    const button = shadowHost("cmb-xbuy-host");
    button.root.append(buy);
    // The button sits inside X's link: never let the click navigate.
    for (const type of ["click", "mousedown", "pointerdown", "keydown"])
      button.host.addEventListener(type, (event) => {
        if (type === "keydown" && (event as KeyboardEvent).key !== "Enter")
          return;
        if (type === "click" || type === "keydown") event.preventDefault();
        event.stopPropagation();
      });
    button.host.style.flex = "0 0 auto";
    button.host.style.alignSelf = "center";
    button.host.style.marginLeft = "8px";
    cardRow(card.link).append(button.host);
  };
  mountButton();
  host.addEventListener("cmb:rebutton", mountButton);

  const align = () => {
    if (!host.isConnected || !card.link.isConnected) return;
    const outer = card.container.getBoundingClientRect();
    const inner = card.link.getBoundingClientRect();
    if (!inner.width) return;
    host.style.display = "block";
    host.style.width = `${inner.width}px`;
    host.style.marginLeft = `${inner.left - outer.left}px`;
  };
  align();
  if (typeof ResizeObserver !== "undefined")
    new ResizeObserver(align).observe(card.link);
  return true;
}
