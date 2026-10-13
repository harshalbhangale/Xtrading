import {
  changeBps,
  formatUsd,
  fromUnits,
  liquidationPrice,
  type PostSignal,
  sizeFromUsd,
  type TradeRoute,
  ticketQuote,
  toUnits,
} from "@call-my-bluff/domain";
import { z } from "zod";
import { appOrigin } from "./config";
import { el, send } from "./dom";
import { tradeUrl } from "./drawer";
import { type PerplWalletStep, signPerplSteps } from "./perp-wallet";
import { hasBrowserWallet } from "./wallet";

const integer = z.string().regex(/^[0-9]{1,30}$/);
const marketSchema = z.object({
  marketId: z.number().int(),
  symbol: z.string().max(20),
  priceDecimals: z.number().int().min(0).max(36),
  sizeDecimals: z.number().int().min(0).max(36),
  open: z.boolean(),
  quote: z.object({ mark: integer.nullable(), previous: integer.nullable() }),
  takerFeePpm: z.number().int().nonnegative().nullable(),
  maxSlippageBps: z.number().int().positive().nullable().optional(),
  marketMaxLeverage: z.number().int().positive().nullable().optional(),
  maintenanceMarginHundredths: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
});
const marketsSchema = z.object({
  perpl: z.object({
    markets: z.array(marketSchema),
    limits: z.object({
      maxLeverage: z.number().int().min(1).max(50),
      maxSize: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
    }),
  }),
});

type Session = { connected: boolean; handle: string | null };
const errors: Record<string, string> = {
  not_connected: "Connect Xtrading to trade from X.",
  invalid_session: "Session expired. Connect again.",
  current_binding_required: "Bind your X account to your wallet in the app.",
  leverage_above_cap: "Leverage is above the app cap.",
  leverage_above_market_max: "Leverage is above this market's maximum.",
  slippage_above_market_max: "Slippage is above this market's maximum.",
  size_above_cap: "Size is above the cap.",
  market_closed: "Market is closed.",
  market_unpriced: "No mark price right now. Try again shortly.",
  collateral_insufficient:
    "Not enough test AUSD in your wallet. Claim some from the faucet in the app.",
  perpl_account_frozen: "Your Perpl account is frozen.",
  perpl_exchange_mismatch: "Perpl's exchange address changed. Not sending.",
  transaction_pending: "Transaction not found yet.",
  transaction_not_from_wallet: "That transaction was not sent by your wallet.",
  order_not_found: "No order from your account in that transaction.",
  perpl_unavailable: "Perpl is unavailable. Try again.",
  rate_limited: "Too many requests. Wait a moment.",
  extension_sessions_unconfigured:
    "Trading from X is not enabled on the server.",
};
const explain = (code: string) => errors[code] ?? code.replaceAll("_", " ");
type Call<T> = { result?: T; failure?: string } | null;

/**
 * Trader-style perp ticket inside the X drawer. Connected users review here and
 * sign with their own browser wallet, trading their own Perpl account; without a
 * browser wallet (e.g. a Privy embedded wallet) the order is finished in the app.
 */
export function perpTicket(
  postId: string,
  signal: PostSignal,
  route: Extract<TradeRoute, { status: "available" }>,
) {
  const root = el(
    "div",
    { class: "ticket" },
    el("p", { class: "note" }, "Loading market…"),
  );
  void Promise.all([
    send<unknown>({ type: "markets" }),
    send<Session>({ type: "session-status" }),
  ]).then(([raw, session]) => {
    const parsed = marketsSchema.safeParse(raw);
    const market = parsed.data?.perpl.markets.find(
      (m) => String(m.marketId) === route.marketId,
    );
    if (!parsed.success || !market?.open) {
      root.replaceChildren(
        el(
          "p",
          { class: "note" },
          "Perpl market data unavailable. Try again shortly.",
        ),
      );
      return;
    }
    render(root, postId, signal, route, market, parsed.data.perpl.limits, {
      connected: session?.connected === true,
      handle: session?.handle ?? null,
    });
  });
  return root;
}

function render(
  root: HTMLElement,
  postId: string,
  signal: PostSignal,
  route: Extract<TradeRoute, { status: "available" }>,
  market: z.infer<typeof marketSchema>,
  limits: { maxLeverage: number; maxSize: string },
  initial: Session,
) {
  let session = initial;
  let side: "long" | "short" = route.side === "short" ? "short" : "long";
  // Perpl's market maximum and the app's cap both apply; the lower one wins.
  const maxLeverage = Math.min(
    limits.maxLeverage,
    market.marketMaxLeverage ?? limits.maxLeverage,
  );
  let leverage = Math.min(Math.max(signal.leverage ?? 2, 1), maxLeverage);
  let unit: "base" | "usd" = "base";
  const mark = market.quote.mark ? BigInt(market.quote.mark) : null;
  const maxUnits = toUnits(limits.maxSize, market.sizeDecimals);
  const usd = (value: bigint | null) =>
    value === null ? "—" : formatUsd(value, market.priceDecimals);
  const change =
    mark && market.quote.previous
      ? changeBps(mark, BigInt(market.quote.previous))
      : null;

  const sideButtons = (["long", "short"] as const).map((choice) => {
    const button = el(
      "button",
      { type: "button", class: `side ${choice}` },
      choice === "long" ? "Long" : "Short",
    );
    button.addEventListener("click", () => {
      side = choice;
      update();
    });
    return button;
  });
  const levButtons = [1, 2, 3, 5, 10, 20]
    .filter((x) => x <= maxLeverage)
    .map((x) => {
      const button = el("button", { type: "button", class: "lev" }, `${x}x`);
      button.addEventListener("click", () => {
        leverage = x;
        update();
      });
      return { x, button };
    });
  const input = el("input", {
    inputmode: "decimal",
    maxlength: "40",
    placeholder: "0",
    "aria-label": "Size",
  }) as HTMLInputElement;
  input.addEventListener("input", () => update());
  const unitButton = el("button", {
    type: "button",
    class: "unit",
    title: "Switch asset / USD",
  });
  unitButton.addEventListener("click", () => {
    unit = unit === "base" ? "usd" : "base";
    input.value = "";
    update();
  });
  const percentButtons = [25, 50, 75, 100].map((pct) => {
    const button = el("button", { type: "button", class: "pct" }, `${pct}%`);
    button.addEventListener("click", () => {
      if (!maxUnits) return;
      unit = "base";
      input.value = fromUnits(
        (maxUnits * BigInt(pct)) / 100n,
        market.sizeDecimals,
      );
      update();
    });
    return button;
  });
  const hint = el("p", { class: "ticket-hint" });
  const value = el("dd", {});
  const margin = el("dd", {});
  const fee = el("dd", {});
  const liquidation = el("dd", {});
  const go = el("a", {
    class: "ticket-go",
    target: "_blank",
    rel: "noopener noreferrer",
  });
  go.addEventListener("click", (event) => {
    const href = go.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    openWalletWindow(href);
  });
  const trade = el("button", { type: "button", class: "ticket-go" });
  const panel = el("div", { class: "ticket-panel" });
  const slippageBps = Math.min(100, market.maxSlippageBps ?? 100);
  let current: Record<string, unknown> | null = null;
  trade.addEventListener("click", () => {
    if (current) void review(current);
  });
  const connect = el(
    "button",
    { type: "button", class: "ticket-link" },
    "Connect Xtrading to trade here ↗",
  );
  connect.addEventListener("click", () => {
    window.open(
      new URL("/extension/connect", appOrigin).href,
      "xtrading-connect",
      "popup,width=460,height=640",
    );
    // Pick up the new session without reloading X.
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const status = await send<Session>({ type: "session-status" });
      if (status?.connected || tries > 60 || !root.isConnected) {
        clearInterval(timer);
        if (status?.connected) {
          session = { connected: true, handle: status.handle };
          update();
        }
      }
    }, 2000);
  });

  root.replaceChildren(
    el(
      "div",
      { class: "ticket-head" },
      el("strong", {}, `${market.symbol}-PERP`),
      el("span", { class: "ticket-mark" }, mark ? usd(mark) : "—"),
      change === null
        ? null
        : el(
            "span",
            { class: change >= 0 ? "up" : "down" },
            `${change >= 0 ? "+" : ""}${(change / 100).toFixed(2)}%`,
          ),
    ),
    el("div", { class: "ticket-side" }, ...sideButtons),
    el(
      "div",
      { class: "ticket-row" },
      el("span", {}, "Leverage"),
      el("div", { class: "ticket-chips" }, ...levButtons.map((b) => b.button)),
    ),
    el(
      "div",
      { class: "ticket-size" },
      el("span", {}, "Size"),
      input,
      unitButton,
    ),
    hint,
    el("div", { class: "ticket-chips pct-row" }, ...percentButtons),
    el(
      "dl",
      { class: "ticket-sum" },
      el("div", {}, el("dt", {}, "Order value"), value),
      el("div", {}, el("dt", {}, "Margin required"), margin),
      el("div", {}, el("dt", {}, "Est. taker fee"), fee),
      el("div", {}, el("dt", {}, "Est. liquidation"), liquidation),
    ),
    go,
    trade,
    panel,
    connect,
    el(
      "p",
      { class: "note" },
      `Max ${limits.maxSize} ${market.symbol}, ${maxLeverage}x · ${(slippageBps / 100).toFixed(2)}% max slippage · estimates before fees and funding · testnet · not advice`,
    ),
  );

  // The app's perp window, prefilled and set to review on open; Privy signs there.
  function walletWindowUrl(order: Record<string, unknown>) {
    const url = new URL("/trade/perp", appOrigin);
    for (const key of ["marketId", "side", "leverage", "size"])
      url.searchParams.set(key, String(order[key]));
    url.searchParams.set("slippage", String(order.slippageBps));
    if (typeof order.sourcePostId === "string")
      url.searchParams.set("postId", order.sourcePostId);
    url.searchParams.set("handle", signal.handle);
    url.searchParams.set("review", "1");
    return url.href;
  }
  function openWalletWindow(href: string) {
    window.open(href, "xtrading-perp", "popup,width=480,height=820");
  }
  type Prepared = {
    wallet: string;
    execution: string;
    requestId: string;
    limitPrice: string;
    steps: PerplWalletStep[];
  };
  async function review(order: Record<string, unknown>) {
    panel.replaceChildren(el("p", { class: "note" }, "Checking order…"));
    trade.hidden = true;
    const [prepared, walletPresent] = await Promise.all([
      send<Call<Prepared>>({ type: "perp-prepare", order }),
      hasBrowserWallet(),
    ]);
    if (!root.isConnected) return;
    if (!prepared?.result) return fail(prepared?.failure ?? "unavailable");
    const review = prepared.result;
    const back = el("button", { type: "button", class: "ticket-back" }, "Back");
    back.addEventListener("click", () => {
      panel.replaceChildren();
      trade.hidden = false;
    });
    // Primary: the Xtrading (Privy) wallet signs in a small window over X.
    const privy = el(
      "button",
      { type: "button", class: `ticket-go ${side}` },
      `Sign with Xtrading wallet ↗`,
    );
    privy.addEventListener("click", () => {
      openWalletWindow(walletWindowUrl(order));
      status.textContent =
        "Sign in the Xtrading window. Your timeline stays open.";
    });
    // Secondary: a browser wallet on X, only when it is the bound wallet.
    const browser = walletPresent
      ? el("button", { type: "button", class: "ticket-back" }, "Browser wallet")
      : null;
    browser?.addEventListener("click", () => void place(order, review));
    const status = el("p", { class: "note" });
    panel.replaceChildren(
      el(
        "p",
        { class: "ticket-mode" },
        el("strong", {}, "YOUR WALLET"),
        ` · ${review.wallet.slice(0, 6)}…${review.wallet.slice(-4)} trades your own Perpl testnet account. Xtrading never signs or holds keys.`,
      ),
      el(
        "ol",
        { class: "ticket-steps" },
        ...review.steps.map((step) => el("li", {}, step.label)),
      ),
      el(
        "p",
        { class: "note" },
        `Limit ${usd(BigInt(review.limitPrice))} (mark ± ${(slippageBps / 100).toFixed(2)}%), immediate-or-cancel.`,
      ),
      el("div", { class: "ticket-confirm" }, privy, browser, back),
      status,
    );
  }
  async function place(order: Record<string, unknown>, review: Prepared) {
    const line = el("p", { class: "note" }, "Starting…");
    panel.replaceChildren(line);
    let hash: string;
    try {
      hash = await signPerplSteps({
        wallet: review.wallet,
        steps: review.steps,
        onStatus: (text) => {
          line.textContent = text;
        },
      });
    } catch (error) {
      if (!root.isConnected) return;
      trade.hidden = false;
      panel.replaceChildren(
        el(
          "p",
          { class: "ticket-hint error" },
          error instanceof Error ? error.message : "Wallet request failed.",
        ),
      );
      return;
    }
    line.textContent = "Reading the result from chain…";
    // The receipt is already mined; retry briefly in case the app's RPC lags.
    type Confirmed = Call<{
      status: string;
      filledSize?: string;
      averagePrice?: string | null;
      message: string;
    }>;
    let confirmed: Confirmed = null;
    for (let attempt = 0; attempt < 5 && root.isConnected; attempt++) {
      confirmed = await send<NonNullable<Confirmed>>({
        type: "perp-confirm",
        order: {
          transactionHash: hash,
          requestId: review.requestId,
          sourcePostId: order.sourcePostId ?? null,
        },
      });
      if (confirmed?.failure !== "transaction_pending") break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    if (!root.isConnected) return;
    trade.hidden = false;
    const result = confirmed?.result;
    const link = el(
      "a",
      {
        href: `https://testnet.monadvision.com/tx/${hash}`,
        target: "_blank",
        rel: "noopener noreferrer",
      },
      "tx ↗",
    );
    if (!result) {
      panel.replaceChildren(
        el("p", { class: "ticket-mode" }, el("strong", {}, "Sent")),
        el(
          "p",
          { class: "note" },
          `Sent from your wallet; the result could not be read back (${explain(confirmed?.failure ?? "unavailable")}). `,
          link,
        ),
      );
      return;
    }
    const filled =
      result.filledSize && result.filledSize !== "0"
        ? `${fromUnits(BigInt(result.filledSize), market.sizeDecimals)} ${market.symbol}${result.averagePrice ? ` @ ${usd(BigInt(result.averagePrice))}` : ""} · `
        : "";
    panel.replaceChildren(
      el(
        "p",
        {
          class: `ticket-mode ${result.status === "filled" || result.status === "partially-filled" ? "submitted" : "rejected"}`,
        },
        el("strong", {}, result.status.replace("-", " ")),
      ),
      el("p", { class: "note" }, filled, result.message, " ", link),
    );
  }
  function fail(code: string) {
    if (code === "not_connected" || code === "invalid_session") {
      session = { connected: false, handle: null };
      update();
    }
    trade.hidden = !session.connected;
    panel.replaceChildren(
      el("p", { class: "ticket-hint error" }, explain(code)),
    );
  }

  function update() {
    for (const [index, button] of sideButtons.entries())
      button.setAttribute(
        "aria-pressed",
        String((index === 0 ? "long" : "short") === side),
      );
    for (const { x, button } of levButtons)
      button.setAttribute("aria-pressed", String(x === leverage));
    unitButton.textContent = `${unit === "usd" ? "USD" : market.symbol} ⇄`;
    const raw = input.value.trim();
    let units: bigint | null = null;
    if (raw) {
      if (unit === "base") units = toUnits(raw, market.sizeDecimals);
      else {
        const dollars = toUnits(raw, market.priceDecimals);
        units =
          dollars !== null && mark
            ? sizeFromUsd(dollars, mark, market.sizeDecimals)
            : null;
      }
    }
    const error = !raw
      ? ""
      : units === null
        ? `Use at most ${market.sizeDecimals} decimals`
        : units === 0n
          ? "Size rounds to zero"
          : maxUnits !== null && units > maxUnits
            ? `Above the ${limits.maxSize} ${market.symbol} cap`
            : "";
    hint.textContent =
      error ||
      (unit === "usd" && units
        ? `≈ ${fromUnits(units, market.sizeDecimals)} ${market.symbol}`
        : "");
    hint.className = `ticket-hint${error ? " error" : ""}`;
    const quote =
      units && mark && !error
        ? ticketQuote({
            sizeUnits: units,
            sizeDecimals: market.sizeDecimals,
            price: mark,
            priceDecimals: market.priceDecimals,
            leverage,
            takerFeePpm: market.takerFeePpm ?? 0,
          })
        : null;
    value.textContent = usd(quote?.notional ?? null);
    margin.textContent = usd(quote?.margin ?? null);
    fee.textContent = quote
      ? formatUsd(quote.feeFine, market.priceDecimals + 4)
      : "—";
    const liq =
      quote && mark && market.maintenanceMarginHundredths
        ? liquidationPrice({
            entry: mark,
            side,
            leverageHundredths: leverage * 100,
            maintenanceHundredths: market.maintenanceMarginHundredths,
          })
        : null;
    liquidation.textContent = usd(liq);

    const href = tradeUrl(postId, signal, route);
    const ready = Boolean(href && units && !error);
    const label = `${side === "long" ? "Long" : "Short"} ${fromUnits(units ?? 0n, market.sizeDecimals)} ${market.symbol} · ${leverage}x`;
    // Connected: review and submit here. Otherwise: hand off to the app.
    go.hidden = session.connected;
    // Any edit invalidates a pending review or a shown result.
    if (panel.childElementCount) panel.replaceChildren();
    trade.hidden = !session.connected;
    connect.hidden = session.connected;
    current = ready
      ? {
          marketId: market.marketId,
          side,
          size: fromUnits(units ?? 0n, market.sizeDecimals),
          leverage,
          slippageBps,
          sourcePostId: /^[0-9]{1,30}$/.test(postId) ? postId : null,
        }
      : null;
    trade.className = `ticket-go ${side}${ready ? "" : " disabled"}`;
    trade.toggleAttribute("disabled", !ready);
    trade.textContent = ready
      ? `Review ${label}`
      : `Enter a size to ${side} ${market.symbol}`;
    go.className = `ticket-go ${side}${ready ? "" : " disabled"}`;
    go.textContent = ready
      ? `${label} · Xtrading wallet ↗`
      : `Enter a size to ${side} ${market.symbol}`;
    if (ready && href && current) {
      go.setAttribute("href", walletWindowUrl(current));
      go.removeAttribute("aria-disabled");
    } else {
      go.removeAttribute("href");
      go.setAttribute("aria-disabled", "true");
    }
  }
  update();
}
