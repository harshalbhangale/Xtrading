import {
  decimalAtoms,
  displayAtoms,
  inlineQuoteSchema,
  type PostSignal,
  publicPayoutSchema,
  type TradeRoute,
} from "@call-my-bluff/domain";
import { appOrigin } from "./config";
import { el, safeLink, send } from "./dom";
import { loadInsights, postAttachments } from "./drawer";
import {
  kuruPrice,
  priceLine,
  readXTicker,
  sparklineSvg,
} from "./ticker-price";

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

/** All amounts stay in the isolated extension; authentication/signing stay on the app origin. */
export function inlineTrade(
  signal: InlinePost,
  route: TradeRoute,
  article?: HTMLElement,
) {
  return buildInline(signal, route, { article, attached: false }).card;
}

/**
 * The same panel, attached beneath X's own ticker card: X's card already shows
 * the live price and chart, so only a Buy button goes into it and the panel
 * starts hidden until that button is pressed.
 */
export function attachedTrade(post: InlinePost, route: TradeRoute) {
  const { card, buy } = buildInline(post, route, { attached: true });
  return { panel: card, buy };
}

function buildInline(
  signal: InlinePost,
  route: TradeRoute,
  options: { article?: HTMLElement; attached: boolean },
) {
  const { article, attached } = options;
  const market = inlineMarket(signal);
  const card = el("section", {
    class: "inline-card",
    "aria-label": "Xtrading inline trade",
  });
  const symbol =
    market === "WBTC"
      ? "BTC"
      : market === "WETH"
        ? "ETH"
        : (signal.asset ?? "Token");
  const title = el(
    "strong",
    {},
    symbol === "ETH"
      ? "Ethereum"
      : symbol === "BTC"
        ? "Bitcoin"
        : symbol === "MON"
          ? "Monad"
          : symbol,
  );
  // Quote-specific line; the live market price sits in the ticker row above it.
  const price = el("span", { class: "inline-price" });
  const tickerRow = el(
    "div",
    { class: "inline-ticker-row" },
    el("span", { class: "inline-ticker muted" }, "Loading price…"),
  );
  const tickerAsset =
    symbol === "ETH" || symbol === "BTC" || symbol === "MON" ? symbol : null;
  // Prefer X's own live ticker card in this post; otherwise Kuru mainnet's last trade.
  const updateTicker = async () => {
    const fromX = article && tickerAsset ? readXTicker(article, symbol) : null;
    const live = fromX ?? (tickerAsset ? await kuruPrice(tickerAsset) : null);
    const spark = live?.sparkline.length
      ? sparklineSvg(live.sparkline, Number(live.change24hPct ?? 0) >= 0)
      : null;
    tickerRow.replaceChildren(priceLine(live), ...(spark ? [spark] : []));
  };
  if (!attached) {
    void updateTicker();
    const tickerTimer = setInterval(() => {
      if (!card.isConnected && card.dataset.mounted) clearInterval(tickerTimer);
      else void updateTicker();
    }, 30000);
  }
  const buy = el(
    "button",
    { type: "button", class: "inline-buy", "aria-expanded": "false" },
    "⇄ Buy",
  );
  const close = el(
    "button",
    {
      type: "button",
      class: "inline-close",
      hidden: "",
      "aria-label": "Close swap",
    },
    "× Close",
  );
  if (attached) {
    card.hidden = true;
    card.classList.add("inline-attached");
    card.append(
      el(
        "header",
        { class: "inline-header" },
        el(
          "div",
          { class: "inline-asset" },
          el("strong", {}, `Trade ${symbol} on Kuru`),
          price,
        ),
        close,
      ),
    );
  } else
    card.append(
      el(
        "header",
        { class: "inline-header" },
        el(
          "span",
          { class: "asset-icon", "aria-hidden": "true" },
          symbol === "ETH" ? "Ξ" : symbol === "BTC" ? "₿" : "M",
        ),
        el("div", { class: "inline-asset" }, title, tickerRow, price),
        buy,
        close,
      ),
    );
  const panel = el("div", { class: "inline-panel", hidden: "" });
  let chainId: 10143 | 143 = 10143,
    side: "buy" | "sell" = "buy",
    sequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  const network = el(
    "select",
    { "aria-label": "Trading network", class: "inline-network" },
    el("option", { value: "10143" }, "Monad Testnet"),
    el("option", { value: "143" }, "Monad Mainnet · real funds"),
  ) as HTMLSelectElement;
  const sides = el("div", {
    class: "inline-sides",
    role: "group",
    "aria-label": "Trade side",
  });
  const pay = el("span", { class: "inline-symbol" }, "USDC");
  const receive = el("span", { class: "inline-symbol" }, market ?? symbol);
  const amount = el("input", {
    class: "inline-amount",
    inputmode: "decimal",
    maxlength: "40",
    placeholder: "0",
    "aria-label": "Amount to spend",
    autocomplete: "off",
  }) as HTMLInputElement;
  const result = el("strong", { class: "inline-output" }, "—");
  const status = el(
    "p",
    { class: "inline-note", role: "status", "aria-live": "polite" },
    "Enter an amount to get a book indication.",
  );
  const slippage = el(
    "select",
    { class: "inline-network", "aria-label": "Maximum slippage" },
    el("option", { value: "50" }, "0.5% slippage"),
    el("option", { value: "100" }, "1% slippage"),
    el("option", { value: "200" }, "2% slippage"),
  ) as HTMLSelectElement;
  const review = el(
    "button",
    { type: "button", class: "inline-submit", disabled: "" },
    "Review in wallet",
  );
  const feeChoice = el("input", {
    type: "checkbox",
    "aria-label": "Pay creator fee",
  }) as HTMLInputElement;
  const feeText = el(
    "span",
    {},
    "Creator payouts unavailable · no creator fee selected.",
  );
  const feeRow = el("label", { class: "inline-fee" }, feeChoice, feeText);
  feeChoice.hidden = true;
  void send<unknown>({ type: "creator-payout", handle: signal.handle }).then(
    (raw) => {
      const payout = publicPayoutSchema.safeParse(raw);
      if (
        !payout.success ||
        !payout.data.creator ||
        payout.data.creator.handle !== signal.handle ||
        !payout.data.mainnetFeesEnabled
      )
        return;
      feeChoice.hidden = false;
      feeChoice.disabled = chainId !== 143 || side !== "buy";
      feeText.textContent = `Optional: ${payout.data.bps / 100}% of bought-token output to @${signal.handle} (creator tier) · mainnet buys only.`;
    },
  );
  const explanation = el(
    "p",
    { class: "inline-note" },
    "Connect your wallet in secure review. Balances and gas are checked there. No signing or login tokens are shared with X.",
  );
  const tokenDecimals = () => (side === "buy" ? 6 : market === "WBTC" ? 8 : 18);
  function refresh() {
    sequence++;
    clearTimeout(timer);
    clearTimeout(expiryTimer);
    price.textContent = "";
    review.setAttribute("disabled", "");
    result.textContent = "—";
    pay.textContent =
      side === "buy"
        ? "USDC"
        : market === "WBTC" && chainId === 143
          ? "cbBTC"
          : (market ?? symbol);
    receive.textContent =
      side === "sell"
        ? "USDC"
        : market === "WBTC" && chainId === 143
          ? "cbBTC"
          : (market ?? symbol);
    title.textContent = `${symbol === "ETH" ? "Ethereum · WETH" : symbol === "BTC" && chainId === 143 ? "Coinbase Bitcoin · cbBTC" : symbol === "BTC" ? "Bitcoin · WBTC" : "Monad"}`;
    feeChoice.disabled = chainId !== 143 || side !== "buy";
    if (feeChoice.disabled) feeChoice.checked = false;
    const atoms = decimalAtoms(amount.value, tokenDecimals());
    if (!market || !atoms) {
      status.textContent = market
        ? "Enter a positive amount with valid token precision."
        : route.status === "unavailable"
          ? route.reason
          : "This asset is not available for Kuru spot trading.";
      return;
    }
    review.removeAttribute("disabled"); // Review independently simulates; an indication is not authorization.
    status.textContent = "Loading Kuru indication…";
    const requestId = sequence;
    timer = setTimeout(async () => {
      const raw = await send<unknown>({
        type: "inline-quote",
        payload: {
          chainId,
          market,
          side,
          amount: atoms,
          slippageBps: Number(slippage.value),
        },
      });
      if (sequence !== requestId || !card.isConnected) return;
      const quote = inlineQuoteSchema.safeParse(raw);
      if (
        !quote.success ||
        quote.data.chainId !== chainId ||
        quote.data.market !== market ||
        quote.data.side !== side ||
        quote.data.amount !== atoms ||
        Date.parse(quote.data.expiresAt) <= Date.now()
      ) {
        status.textContent =
          "Quote unavailable. Secure review will check live execution; no network fallback.";
        price.textContent = "Quote unavailable";
        return;
      }
      const gross = quote.data.expectedOutput
        ? BigInt(quote.data.expectedOutput)
        : null;
      const net =
        gross === null
          ? null
          : feeChoice.checked && chainId === 143 && side === "buy"
            ? gross - (gross * 50n) / 10000n
            : gross;
      result.textContent =
        net !== null
          ? `≈ ${displayAtoms(net.toString(), quote.data.output.decimals)}`
          : "Unavailable";
      price.textContent = quote.data.price
        ? `Kuru ${chainId === 143 ? "mainnet" : "testnet"} book: $${quote.data.price}${chainId === 143 ? "" : " (test tokens)"}`
        : "";
      status.textContent = `Indicative · block ${quote.data.blockNumber}. ${quote.data.filled ? "Depth observed; execution still needs simulation." : "Available fill is checked in wallet review."}`;
      expiryTimer = setTimeout(
        () => {
          if (sequence !== requestId || !card.isConnected) return;
          result.textContent = "—";
          price.textContent = "Market data expired";
          status.textContent =
            "Indication expired. Change the amount to refresh, or continue to a fresh wallet review.";
        },
        Math.max(0, Date.parse(quote.data.expiresAt) - Date.now()),
      );
    }, 400);
  }
  const sideButtons: HTMLElement[] = [];
  for (const value of ["buy", "sell"] as const) {
    const button = el(
      "button",
      { type: "button", "aria-pressed": String(value === side) },
      value === "buy" ? "Buy" : "Sell",
    );
    button.addEventListener("click", () => {
      side = value;
      for (const b of sideButtons)
        b.setAttribute("aria-pressed", String(b === button));
      amount.value = "";
      refresh();
    });
    sideButtons.push(button);
    sides.append(button);
  }
  network.addEventListener("change", () => {
    chainId = network.value === "143" ? 143 : 10143;
    price.textContent = "";
    refresh();
  });
  feeChoice.addEventListener("change", refresh);
  amount.addEventListener("input", refresh);
  slippage.addEventListener("change", refresh);
  function toggle(open: boolean) {
    panel.hidden = !open;
    if (attached) card.hidden = !open;
    buy.hidden = open;
    close.hidden = !open;
    buy.setAttribute("aria-expanded", String(open));
    if (open) {
      refresh();
      amount.focus({ preventScroll: true });
    } else {
      sequence++;
      clearTimeout(timer);
      clearTimeout(expiryTimer);
      buy.focus({ preventScroll: true });
    }
  }
  buy.addEventListener("click", () => toggle(true));
  close.addEventListener("click", () => toggle(false));
  card.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && !panel.hidden)
      toggle(false);
  });
  review.addEventListener("click", () => {
    if (!market || !decimalAtoms(amount.value, tokenDecimals())) return;
    const url = new URL("/trade/inline", appOrigin);
    for (const [key, value] of Object.entries({
      chainId: String(chainId),
      market,
      side,
      amount: amount.value,
      slippage: slippage.value,
      postId: signal.postId,
      handle: signal.handle,
    }))
      url.searchParams.set(key, value);
    if (feeChoice.checked && chainId === 143 && side === "buy")
      url.searchParams.set("payCreator", "1");
    const popup = window.open(
      url.href,
      "_blank",
      "popup,width=480,height=760,noopener,noreferrer",
    );
    // noopener may return null even when a window opened; always offer the same reviewed link.
    void popup;
    status.replaceChildren(
      "Continue in secure wallet review. ",
      safeLink(url.href, "Open review ↗"),
    );
  });
  panel.append(
    el("div", { class: "inline-controls" }, sides, network),
    el(
      "label",
      { class: "inline-pay" },
      el("span", { class: "inline-note" }, "You pay"),
      el("div", { class: "inline-value" }, amount, pay),
    ),
    el(
      "div",
      { class: "inline-receive" },
      el("span", { class: "inline-note" }, "You receive · indication"),
      el("div", { class: "inline-value" }, result, receive),
    ),
    el(
      "div",
      { class: "inline-controls" },
      slippage,
      el("span", { class: "inline-note" }, "Via Kuru"),
    ),
    status,
    explanation,
    feeRow,
    review,
  );
  const analytics = el(
    "details",
    { class: "inline-analytics" },
    el("summary", {}, `Expand @${signal.handle} · creator record`),
  );
  let loaded = false;
  analytics.addEventListener("toggle", async () => {
    if (!(analytics as HTMLDetailsElement).open || loaded) return;
    loaded = true;
    const body = el(
      "div",
      { class: "inline-evidence" },
      "Loading creator evidence…",
    );
    analytics.append(body);
    const insight = await loadInsights(
      signal.handle,
      signal.asset,
      signal.direction,
    );
    if (!card.isConnected) return;
    body.replaceChildren(
      insight
        ? el(
            "p",
            {},
            `${insight.evidence?.identity.status === "bound" ? "X account linked" : "X account not linked"} · ${insight.reputation.trackedCalls} tracked calls · ${insight.reputation.score === null ? "Performance not evaluated" : `Call score ${insight.reputation.score}`}`,
          )
        : el("p", {}, "Creator evidence unavailable."),
      el(
        "p",
        { class: "inline-note" },
        "Call performance and actual wallet returns are separate. Account linking is not proof of unique humanity or profitable advice.",
      ),
      ...(insight?.nansen.findings.map((f) =>
        el(
          "p",
          { class: "inline-note" },
          `${insight.nansen.mode === "demo" ? "DEMO · " : ""}${f.summary}`,
        ),
      ) ?? []),
      safeLink(
        new URL(`/creators/${signal.handle}`, appOrigin).href,
        "Full creator analytics ↗",
      ),
      ...(signal.signal ? [postAttachments(signal.signal)] : []),
    );
  });
  card.append(
    panel,
    analytics,
    el(
      "footer",
      { class: "inline-footer" },
      safeLink(
        `https://x.com/${signal.handle}/status/${signal.postId}`,
        "View post ↗",
      ),
      el("span", {}, "Xtrading · Kuru"),
    ),
  );
  if (
    !market ||
    (route.status === "available" && route.instrument === "perp")
  ) {
    buy.hidden = true;
    price.textContent =
      route.status === "unavailable"
        ? route.reason
        : "Perpetual call · review on Perpl";
  }
  if (market)
    void send<unknown>({
      type: "inline-quote",
      payload: {
        chainId: 10143,
        market,
        side: "buy",
        amount: "10000000",
        slippageBps: 50,
      },
    }).then((raw) => {
      const quote = inlineQuoteSchema.safeParse(raw);
      if (
        sequence !== 0 ||
        !card.isConnected ||
        !quote.success ||
        quote.data.chainId !== 10143 ||
        quote.data.market !== market ||
        Date.parse(quote.data.expiresAt) <= Date.now()
      )
        return;
      price.textContent = quote.data.price
        ? `Kuru testnet book: $${quote.data.price} (test tokens)`
        : "";
      expiryTimer = setTimeout(
        () => {
          if (sequence === 0 && card.isConnected)
            price.textContent = "Market data expired";
        },
        Math.max(0, Date.parse(quote.data.expiresAt) - Date.now()),
      );
    });
  return { card, buy };
}
