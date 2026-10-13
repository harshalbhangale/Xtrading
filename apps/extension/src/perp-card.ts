import {
  changeBps,
  formatUsd,
  type PostSignal,
  type TradeRoute,
} from "@call-my-bluff/domain";
import { z } from "zod";
import { callInsights } from "./call-insights";
import { appOrigin } from "./config";
import { el, safeLink, send } from "./dom";
import { perpTicket } from "./perp-ticket";
import { logo, tokenIcon } from "./swap-card";

const names: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  MON: "Monad",
  SOL: "Solana",
};
const marketSchema = z.object({
  perpl: z.object({
    markets: z.array(
      z.object({
        marketId: z.number().int(),
        symbol: z.string().max(20),
        priceDecimals: z.number().int().min(0).max(36),
        quote: z.object({
          mark: z
            .string()
            .regex(/^[0-9]{1,30}$/)
            .nullable(),
          previous: z
            .string()
            .regex(/^[0-9]{1,30}$/)
            .nullable(),
        }),
      }),
    ),
  }),
});

/**
 * Perp calls get the same X-style card as spot: price header, the call check,
 * then an in-place Perpl ticket. Orders are signed by the user's own wallet.
 */
export function perpCard(input: {
  postId: string;
  signal: PostSignal;
  route: Extract<TradeRoute, { status: "available" }>;
}) {
  const { signal, route } = input;
  const asset = signal.asset ?? route.market.split(" ")[0] ?? "PERP";
  const card = el("section", {
    class: "inline-card swap-card perp-card",
    "aria-label": `Trade ${asset} perp with Xtrading`,
  });
  const priceText = el("b", {}, "…");
  const changeText = el("em", {});
  const side =
    route.side === "short" ? "Short" : route.side === "long" ? "Long" : null;
  const trade = el(
    "button",
    { type: "button", class: "inline-buy", "aria-expanded": "false" },
    side ? `⇄ ${side}` : "⇄ Trade",
  );
  const close = el(
    "button",
    {
      type: "button",
      class: "inline-close",
      hidden: "",
      "aria-label": "Close",
    },
    "✕ Close",
  );
  const panel = el("div", { class: "inline-panel", hidden: "" });
  let mounted = false;

  void send<unknown>({ type: "markets" }).then((raw) => {
    const market = marketSchema
      .safeParse(raw)
      .data?.perpl.markets.find((m) => String(m.marketId) === route.marketId);
    if (!market?.quote.mark) {
      priceText.textContent = "price unavailable";
      return;
    }
    const mark = BigInt(market.quote.mark);
    priceText.textContent = formatUsd(mark, market.priceDecimals);
    const change = market.quote.previous
      ? changeBps(mark, BigInt(market.quote.previous))
      : null;
    changeText.textContent =
      change === null
        ? ""
        : `${change >= 0 ? "+" : "−"}${Math.abs(change / 100).toFixed(2)}%`;
    changeText.className = change !== null && change < 0 ? "down" : "up";
  });

  function toggle(open: boolean) {
    panel.hidden = !open;
    trade.hidden = open;
    close.hidden = !open;
    trade.setAttribute("aria-expanded", String(open));
    // Build the ticket on first open; it fetches markets and session state.
    if (open && !mounted) {
      mounted = true;
      panel.append(
        perpTicket(input.postId, signal, route),
        el(
          "footer",
          { class: "swap-footer" },
          el(
            "span",
            { class: "swap-powered" },
            "Powered by",
            logo(),
            el("i", { class: "swap-powered-sep", "aria-hidden": "true" }),
            el("b", { class: "perp-venue" }, "Perpl"),
          ),
          safeLink(
            new URL(`/creators/${signal.handle}`, appOrigin).href,
            `@${signal.handle} record ↗`,
          ),
        ),
      );
    }
  }
  trade.addEventListener("click", () => toggle(true));
  close.addEventListener("click", () => toggle(false));
  card.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && !panel.hidden)
      toggle(false);
  });

  card.append(
    el(
      "header",
      { class: "swap-head" },
      tokenIcon(asset),
      el(
        "div",
        { class: "swap-title" },
        el("strong", {}, names[asset] ?? asset),
        el("span", {}, `${asset}-PERP `, priceText, " ", changeText),
      ),
      el(
        "span",
        { class: "perp-badge" },
        `Perpl${signal.leverage ? ` · ${signal.leverage}x` : ""}`,
      ),
      trade,
      close,
    ),
    callInsights({ postId: input.postId, handle: signal.handle, signal }),
    panel,
  );
  return card;
}
