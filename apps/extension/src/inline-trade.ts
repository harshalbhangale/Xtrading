import type { PostSignal, TradeRoute } from "@call-my-bluff/domain";
import { swapCard } from "./swap-card";
/** What the inline card needs about a post; a classified signal is optional. */
export type InlinePost = Pick<
  PostSignal,
  "postId" | "handle" | "asset" | "direction" | "instrument" | "tokenReferences"
> & { signal?: PostSignal };

export function inlineMarket(
  signal: Pick<PostSignal, "asset" | "instrument" | "tokenReferences">,
): "MON" | "WETH" | "WBTC" | null {
  if (signal.tokenReferences.length || signal.instrument === "perp")
    return null;
  return signal.asset === "ETH" || signal.asset === "WETH"
    ? "WETH"
    : signal.asset === "BTC" || signal.asset === "WBTC"
      ? "WBTC"
      : signal.asset === "MON"
        ? "MON"
        : null;
}

/** Trade card for a post (Kuru mainnet by default); signing stays on the app origin. */
export function inlineTrade(
  signal: InlinePost,
  _route: TradeRoute,
  article?: HTMLElement,
) {
  const market = inlineMarket(signal);
  if (!market) throw new Error("unsupported market");
  return swapCard({
    postId: signal.postId,
    handle: signal.handle,
    market,
    article,
    signal: signal.signal,
  }).card;
}

/** The same card attached beneath X's own ticker card, starting hidden. */
export function attachedTrade(post: InlinePost, _route: TradeRoute) {
  const market = inlineMarket(post);
  if (!market) throw new Error("unsupported market");
  const { card, buy } = swapCard({
    postId: post.postId,
    handle: post.handle,
    market,
    attached: true,
  });
  return { panel: card, buy };
}
