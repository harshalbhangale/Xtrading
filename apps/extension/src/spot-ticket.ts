import {
  formatUsd,
  fromUnits,
  type PostSignal,
  spotEstimate,
  type TradeRoute,
  toUnits,
} from "@call-my-bluff/domain";
import { z } from "zod";
import { el, send } from "./dom";
import { tradeUrl } from "./drawer";

const integer = z.string().regex(/^[0-9]{1,40}$/);
const token = z.object({
  symbol: z.string().max(12),
  decimals: z.number().int().min(0).max(36),
});
const bookSchema = z.object({
  key: z.enum(["MON", "WETH", "WBTC"]),
  base: token,
  quote: token,
  pricePrecision: z.string().regex(/^10*$/),
  takerFeePps: integer,
  minimumQuote: integer,
  bestBid: integer.nullable(),
  bestAsk: integer.nullable(),
});
const marketsSchema = z.object({ kuru: z.array(z.unknown()) });

/**
 * Kuru spot ticket in the X drawer. Spot trades are signed by the user's own wallet,
 * so the button opens a small Xtrading window over X for the Privy signature.
 */
export function spotTicket(
  postId: string,
  signal: PostSignal,
  route: Extract<TradeRoute, { status: "available" }>,
) {
  const root = el(
    "div",
    { class: "ticket" },
    el("p", { class: "note" }, "Loading market…"),
  );
  void send<unknown>({ type: "markets" }).then((raw) => {
    const books = marketsSchema.safeParse(raw).data?.kuru ?? [];
    const book = books
      .map((item) => bookSchema.safeParse(item).data)
      .find((item) => item?.key === route.marketId);
    if (!book) {
      root.replaceChildren(
        el(
          "p",
          { class: "note" },
          "Kuru market data unavailable. Try again shortly.",
        ),
      );
      return;
    }
    render(root, postId, signal, route, book);
  });
  return root;
}

function render(
  root: HTMLElement,
  postId: string,
  signal: PostSignal,
  route: Extract<TradeRoute, { status: "available" }>,
  book: z.infer<typeof bookSchema>,
) {
  let side: "buy" | "sell" = route.side === "sell" ? "sell" : "buy";
  const priceDecimals = book.pricePrecision.length - 1;
  const fmt = (value: string | null) =>
    value ? formatUsd(BigInt(value), priceDecimals) : "—";
  const sideButtons = (["buy", "sell"] as const).map((choice) => {
    const button = el(
      "button",
      { type: "button", class: `side ${choice === "buy" ? "long" : "short"}` },
      `${choice === "buy" ? "Buy" : "Sell"} ${book.base.symbol}`,
    );
    button.addEventListener("click", () => {
      side = choice;
      input.value = "";
      update();
    });
    return button;
  });
  const input = el("input", {
    inputmode: "decimal",
    maxlength: "40",
    placeholder: "0",
    "aria-label": "Amount",
  }) as HTMLInputElement;
  input.addEventListener("input", () => update());
  const unit = el("span", { class: "unit" });
  const label = el("span", {});
  const hint = el("p", { class: "ticket-hint" });
  const receive = el("dd", {});
  const price = el("dd", {});
  const fee = el("dd", {});
  const go = el("button", { type: "button", class: "ticket-go" });
  let href: string | null = null;
  go.addEventListener("click", () => {
    // A small window over X; the wallet signature happens there.
    if (href) window.open(href, "xtrading-trade", "popup,width=480,height=760");
  });
  root.replaceChildren(
    el(
      "div",
      { class: "ticket-head" },
      el("strong", {}, `${book.base.symbol}/USDC`),
      el("span", { class: "ticket-mark" }, fmt(book.bestAsk ?? book.bestBid)),
      el("span", { class: "ticket-venue" }, "Kuru spot"),
    ),
    el("div", { class: "ticket-side" }, ...sideButtons),
    el("div", { class: "ticket-size" }, label, input, unit),
    hint,
    el(
      "dl",
      { class: "ticket-sum" },
      el("div", {}, el("dt", {}, "You receive ≈"), receive),
      el("div", {}, el("dt", {}, "Price"), price),
      el("div", {}, el("dt", {}, "Est. taker fee"), fee),
    ),
    go,
    el(
      "p",
      { class: "note" },
      `Your wallet signs in a small window; you stay on X · min ${fromUnits(BigInt(book.minimumQuote), book.quote.decimals)} USDC · testnet · not advice`,
    ),
  );

  function update() {
    for (const [index, button] of sideButtons.entries())
      button.setAttribute(
        "aria-pressed",
        String((index === 0 ? "buy" : "sell") === side),
      );
    const tokenIn = side === "buy" ? book.quote : book.base;
    const tokenOut = side === "buy" ? book.base : book.quote;
    label.textContent = side === "buy" ? "Spend" : "Sell";
    unit.textContent = tokenIn.symbol;
    const bestPrice = side === "buy" ? book.bestAsk : book.bestBid;
    price.textContent = fmt(bestPrice);
    const raw = input.value.trim();
    const amount = raw ? toUnits(raw, tokenIn.decimals) : null;
    const error =
      raw && amount === null
        ? `Use at most ${tokenIn.decimals} decimals`
        : !bestPrice
          ? `No ${side === "buy" ? "sellers" : "buyers"} on the book right now`
          : "";
    hint.textContent = error;
    hint.className = `ticket-hint${error ? " error" : ""}`;
    const estimate =
      amount && bestPrice
        ? spotEstimate({
            side,
            amount,
            price: BigInt(bestPrice),
            pricePrecision: BigInt(book.pricePrecision),
            baseDecimals: book.base.decimals,
            quoteDecimals: book.quote.decimals,
            takerFeePps: BigInt(book.takerFeePps),
          })
        : null;
    receive.textContent = estimate
      ? `${fromUnits(estimate.output, tokenOut.decimals)} ${tokenOut.symbol}`
      : "—";
    fee.textContent = estimate
      ? `${fromUnits(estimate.fee, tokenOut.decimals)} ${tokenOut.symbol}`
      : "—";
    const base = tradeUrl(postId, signal, route);
    const ready = Boolean(base && amount && !error);
    href = null;
    if (ready && base) {
      const url = new URL(base);
      url.searchParams.set("side", side);
      url.searchParams.set("amount", raw);
      url.searchParams.set("popup", "1");
      href = url.href;
    }
    go.className = `ticket-go ${side === "buy" ? "long" : "short"}${ready ? "" : " disabled"}`;
    go.toggleAttribute("disabled", !ready);
    go.textContent = ready
      ? `${side === "buy" ? "Buy" : "Sell"} ${book.base.symbol} · ${raw} ${tokenIn.symbol} ↗`
      : `Enter an amount to ${side} ${book.base.symbol}`;
  }
  update();
}
