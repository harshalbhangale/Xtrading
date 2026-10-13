import {
  decimalAtoms,
  displayAtoms,
  inlineQuoteSchema,
  type PostSignal,
  publicPayoutSchema,
  type TradeRoute,
} from "@call-my-bluff/domain";
import { callInsights } from "./call-insights";
import { appOrigin } from "./config";
import { assetUrl, el, safeLink, send } from "./dom";
import { perpTicket } from "./perp-ticket";
import { riskLine } from "./risk-line";
import {
  formatPrice,
  kuruPrice,
  type LivePrice,
  readXTicker,
  sparklineSvg,
} from "./ticker-price";

export type SwapMarket = "MON" | "WETH" | "WBTC";

/** Lets a later classification upgrade a card that was drawn from a cashtag. */
export type TradeControl = {
  setSignal(signal: PostSignal): void;
  enablePerp(
    signal: PostSignal,
    route: Extract<TradeRoute, { status: "available" }>,
  ): void;
};
const controls = new WeakMap<HTMLElement, TradeControl>();
/** The control for the one trade card inside a post, if there is one. */
export function tradeControl(article: HTMLElement): TradeControl | null {
  for (const host of article.querySelectorAll<HTMLElement>(
    ".cmb-swap-host, .cmb-xticker-host, .cmb-signal-host",
  )) {
    const card = host.shadowRoot?.querySelector<HTMLElement>(".swap-card");
    const control = card ? controls.get(card) : undefined;
    if (control) return control;
  }
  return null;
}
type Asset = "ETH" | "BTC" | "MON";
const assets: Record<SwapMarket, { asset: Asset; name: string }> = {
  WETH: { asset: "ETH", name: "Ethereum" },
  WBTC: { asset: "BTC", name: "Bitcoin" },
  MON: { asset: "MON", name: "Monad" },
};
/** Token actually traded on Kuru for each network. */
const tokenSymbol = (market: SwapMarket, chainId: 143 | 10143) =>
  market === "WBTC" ? (chainId === 143 ? "cbBTC" : "WBTC") : market;
const tokenDecimals = (market: SwapMarket) => (market === "WBTC" ? 8 : 18);

/** Real token coins; the coloured glyph below is the fallback. */
const tokenImages: Record<Asset | "USDC", string> = {
  ETH: "brand/tokens/eth.png",
  BTC: "brand/tokens/btc.png",
  MON: "brand/tokens/mon.png",
  USDC: "brand/tokens/usdc.png",
};

export function tokenIcon(asset: string, size = 40) {
  const image = tokenImages[asset as Asset | "USDC"];
  if (image)
    return el("img", {
      class: "swap-icon",
      src: assetUrl(image),
      width: String(size),
      height: String(size),
      alt: "",
      style: `width:${size}px;height:${size}px;border-radius:50%`,
    });
  const colors: Record<string, string> = {
    ETH: "#627EEA",
    BTC: "#F7931A",
    MON: "#836EF9",
    USDC: "#2775CA",
    SOL: "#9945FF",
  };
  const glyphs: Record<string, string> = {
    ETH: "Ξ",
    BTC: "₿",
    MON: "M",
    USDC: "$",
  };
  const glyph = glyphs[asset] ?? asset.slice(0, 1);
  return el(
    "span",
    {
      class: "swap-icon",
      style: `width:${size}px;height:${size}px;background:${colors[asset] ?? "#536471"};font-size:${Math.round(size * 0.48)}px`,
      "aria-hidden": "true",
    },
    glyph,
  );
}

export function logo() {
  try {
    const url = assetUrl("brand/xtrading-wordmark.png");
    return el("img", {
      class: "swap-wordmark",
      src: url,
      alt: "Xtrading",
      width: "52",
      height: "17",
    });
  } catch {
    return el("span", { class: "swap-logo" });
  }
}

const usd = (value: number) =>
  Number.isFinite(value)
    ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
    : "";

/**
 * XSwap-style trade card for one post: live price header, then an in-place
 * swap panel. Kuru mainnet by default (testnet selectable); signing happens in
 * the Xtrading secure review on the app origin, never on X.
 */
export function swapCard(input: {
  postId: string;
  handle: string;
  market: SwapMarket;
  article?: HTMLElement;
  /** Under X's own ticker card: X already shows the header, so start hidden. */
  attached?: boolean;
  /** The post's classification, when it was read as a call. */
  signal?: PostSignal;
  /** A perp call on this asset: the card opens on Perpl, spot stays one tap away. */
  perp?: {
    signal: PostSignal;
    route: Extract<TradeRoute, { status: "available" }>;
  };
}) {
  const { asset, name } = assets[input.market];
  let chainId: 143 | 10143 = 143,
    side: "buy" | "sell" = "buy",
    live: LivePrice | null = null,
    creatorBps: number | null = null,
    sequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  // The buyer's choice; the fee only applies when the creator is registered,
  // on mainnet buys.
  let creatorOptIn = true;

  const card = el("section", {
    class: `inline-card swap-card${input.attached ? " inline-attached" : ""}`,
    "aria-label": `Trade ${asset} with Xtrading`,
  });
  const priceText = el("b", {}, "…");
  const changeText = el("em", {});
  const sparkSlot = el("span", { class: "swap-spark" });
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
      "aria-label": "Close",
    },
    "✕ Close",
  );
  const header = el(
    "header",
    { class: "swap-head" },
    tokenIcon(asset),
    el(
      "div",
      { class: "swap-title" },
      el("strong", {}, name),
      el("span", {}, `${asset} `, priceText, " ", changeText),
    ),
    sparkSlot,
    buy,
    close,
  );

  // One-line Nansen verdict right above the trade button.
  const risk = riskLine({
    postId: input.postId,
    handle: input.handle,
    asset,
    signal: input.signal,
  });
  // --- panel ---
  const panel = el("div", { class: "inline-panel", hidden: "" });
  const sides = el("div", {
    class: "inline-sides seg",
    role: "group",
    "aria-label": "Side",
  });
  const network = el(
    "select",
    { class: "swap-network", "aria-label": "Trading network" },
    el("option", { value: "143" }, "Monad mainnet"),
    el("option", { value: "10143" }, "Monad testnet"),
  ) as HTMLSelectElement;
  const amount = el("input", {
    class: "inline-amount swap-amount",
    inputmode: "decimal",
    placeholder: "0",
    maxlength: "40",
    autocomplete: "off",
    "aria-label": "You pay",
  }) as HTMLInputElement;
  const payUsd = el("span", { class: "swap-usd" });
  const payToken = el("span", { class: "swap-token" });
  const receiveAmount = el("strong", { class: "inline-output swap-out" }, "0");
  const receiveUsd = el("span", { class: "swap-usd" });
  const receiveToken = el("span", { class: "swap-token" });
  const meta = el("p", { class: "swap-meta" });
  const creatorLine = el("label", { class: "swap-creator", hidden: "" });
  const creatorToggle = el("input", {
    type: "checkbox",
    checked: "",
  }) as HTMLInputElement;
  creatorLine.append(
    creatorToggle,
    el(
      "span",
      {},
      `No creator fee: @${input.handle} has no Xtrading payout wallet.`,
    ),
  );
  const status = el("p", {
    class: "inline-note",
    role: "status",
    "aria-live": "polite",
  });
  const submit = el(
    "button",
    { type: "button", class: "inline-submit swap-submit", disabled: "" },
    `Buy ${asset}`,
  );

  const tokenPill = (symbol: string) =>
    el(
      "span",
      { class: "swap-pill" },
      tokenIcon(symbol === "USDC" ? "USDC" : asset, 22),
      symbol,
    );
  function renderTokens() {
    const token = tokenSymbol(input.market, chainId);
    payToken.replaceChildren(tokenPill(side === "buy" ? "USDC" : token));
    receiveToken.replaceChildren(tokenPill(side === "buy" ? token : "USDC"));
    submit.textContent = `${side === "buy" ? "Buy" : "Sell"} ${asset}`;
  }

  for (const value of ["buy", "sell"] as const) {
    const button = el(
      "button",
      { type: "button", "aria-pressed": String(value === side) },
      value === "buy" ? "Buy" : "Sell",
    );
    button.addEventListener("click", () => {
      side = value;
      for (const b of sides.querySelectorAll("button"))
        b.setAttribute("aria-pressed", String(b === button));
      amount.value = "";
      update();
    });
    sides.append(button);
  }

  // Price header: X's own card when this post has one, else Kuru mainnet.
  async function refreshPrice() {
    const fromX = input.article ? readXTicker(input.article, asset) : null;
    live = fromX ?? (await kuruPrice(asset));
    if (!live) {
      priceText.textContent = "price unavailable";
      changeText.textContent = "";
      return;
    }
    priceText.textContent = formatPrice(live.price);
    const change =
      live.change24hPct === null ? null : Number(live.change24hPct);
    changeText.textContent =
      change === null
        ? ""
        : `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`;
    changeText.className = change !== null && change < 0 ? "down" : "up";
    const spark = live.sparkline.length
      ? sparklineSvg(live.sparkline, (change ?? 0) >= 0)
      : null;
    sparkSlot.replaceChildren(...(spark ? [spark] : []));
    if (!panel.hidden) estimate();
  }
  void refreshPrice();
  const priceTimer = setInterval(() => {
    if (card.dataset.mounted && !card.isConnected) clearInterval(priceTimer);
    else void refreshPrice();
  }, 30000);

  const price = () => (live ? Number(live.price) : Number.NaN);
  /** Instant estimate from the live price while the Kuru indication loads. */
  function estimate() {
    const value = Number(amount.value);
    if (!amount.value || !Number.isFinite(value) || value <= 0) {
      receiveAmount.textContent = "0";
      payUsd.textContent = receiveUsd.textContent = "";
      return null;
    }
    const p = price();
    const out = side === "buy" ? value / p : value * p;
    const fee =
      side === "buy" && creatorBps && creatorToggle.checked && chainId === 143
        ? creatorBps / 10000
        : 0;
    const net = out * (1 - fee);
    receiveAmount.textContent =
      Number.isFinite(net) && net > 0
        ? `≈ ${net.toLocaleString("en-US", { maximumSignificantDigits: 6 })}`
        : "—";
    payUsd.textContent = usd(side === "buy" ? value : value * p);
    receiveUsd.textContent = usd(side === "buy" ? net * p : net);
    return net;
  }

  function update() {
    sequence++;
    clearTimeout(timer);
    clearTimeout(expiry);
    renderTokens();
    // Creator fees apply to mainnet buys only.
    const feeAllowed = Boolean(creatorBps) && chainId === 143 && side === "buy";
    creatorToggle.disabled = !feeAllowed;
    creatorToggle.checked = feeAllowed && creatorOptIn;
    const p = price();
    meta.replaceChildren(
      Number.isFinite(p)
        ? `1 ${asset} ≈ ${formatPrice(live?.price ?? "0").slice(1)} USDC`
        : "Price unavailable",
      " · ",
      el(
        "span",
        {},
        chainId === 143
          ? "Kuru · Monad mainnet"
          : "Kuru · Monad testnet (test tokens)",
      ),
    );
    creatorLine.hidden = false;
    estimate();
    const atoms = decimalAtoms(
      amount.value,
      side === "buy" ? 6 : tokenDecimals(input.market),
    );
    if (!atoms) {
      submit.setAttribute("disabled", "");
      status.textContent = amount.value ? "Enter a positive amount." : "";
      return;
    }
    submit.removeAttribute("disabled");
    status.textContent = "Checking Kuru…";
    const id = sequence;
    timer = setTimeout(async () => {
      const raw = await send<unknown>({
        type: "inline-quote",
        payload: {
          chainId,
          market: input.market,
          side,
          amount: atoms,
          slippageBps: 50,
        },
      });
      if (id !== sequence || !card.isConnected) return;
      const quote = inlineQuoteSchema.safeParse(raw);
      if (
        !quote.success ||
        !quote.data.expectedOutput ||
        quote.data.chainId !== chainId ||
        quote.data.side !== side ||
        quote.data.amount !== atoms ||
        Date.parse(quote.data.expiresAt) <= Date.now()
      ) {
        status.textContent =
          "Estimate from the live price; exact output is checked in review.";
        return;
      }
      const gross = BigInt(quote.data.expectedOutput);
      const net =
        side === "buy" && creatorBps && creatorToggle.checked && chainId === 143
          ? gross - (gross * BigInt(creatorBps)) / 10000n
          : gross;
      receiveAmount.textContent = `≈ ${displayAtoms(net.toString(), quote.data.output.decimals)}`;
      status.textContent = `Kuru order book · block ${quote.data.blockNumber}. Minimum output is set and simulated in review.`;
      expiry = setTimeout(
        () => {
          if (id !== sequence || !card.isConnected) return;
          receiveAmount.textContent = "—";
          status.textContent =
            "Indication expired. Change the amount to refresh, or continue to a fresh review.";
        },
        Math.max(0, Date.parse(quote.data.expiresAt) - Date.now()),
      );
    }, 350);
  }

  void send<unknown>({ type: "creator-payout", handle: input.handle }).then(
    (raw) => {
      const payout = publicPayoutSchema.safeParse(raw);
      if (
        !payout.success ||
        !payout.data.creator ||
        payout.data.creator.handle !== input.handle ||
        !payout.data.mainnetFeesEnabled
      )
        return;
      creatorBps = payout.data.bps;
      creatorLine.replaceChildren(
        creatorToggle,
        el("b", {}, `${creatorBps / 100}%`),
        ` of this buy goes to @${input.handle}, an Xtrading creator.`,
      );
      update();
    },
  );

  network.addEventListener("change", () => {
    chainId = network.value === "10143" ? 10143 : 143;
    update();
  });
  amount.addEventListener("input", update);
  creatorToggle.addEventListener("change", () => {
    creatorOptIn = creatorToggle.checked;
    update();
  });

  submit.addEventListener("click", () => {
    const decimals = side === "buy" ? 6 : tokenDecimals(input.market);
    if (!decimalAtoms(amount.value, decimals)) return;
    const url = new URL("/trade/inline", appOrigin);
    for (const [key, value] of Object.entries({
      chainId: String(chainId),
      market: input.market,
      side,
      amount: amount.value,
      slippage: "50",
      postId: input.postId,
      handle: input.handle,
    }))
      url.searchParams.set(key, value);
    if (
      creatorBps &&
      creatorToggle.checked &&
      chainId === 143 &&
      side === "buy"
    )
      url.searchParams.set("payCreator", "1");
    window.open(
      url.href,
      "_blank",
      "popup,width=480,height=760,noopener,noreferrer",
    );
    status.replaceChildren(
      "Sign in the Xtrading window with your wallet. ",
      safeLink(url.href, "Open review ↗"),
    );
  });

  // Spot (Kuru) and perp (Perpl) share this one card; the post's wording picks
  // the default and the user can switch.
  const spotPane = el("div", { class: "trade-pane" });
  const perpPane = el("div", { class: "trade-pane", hidden: "" });
  const modes = el("div", {
    class: "inline-sides seg trade-modes",
    role: "group",
    "aria-label": "Instrument",
    hidden: "",
  });
  const venue = el("span", { class: "swap-venue" });
  let mode: "spot" | "perp" = "spot";
  let perp: {
    signal: PostSignal;
    route: Extract<TradeRoute, { status: "available" }>;
  } | null = null;
  let perpMounted = false;
  const modeButtons = (["spot", "perp"] as const).map((value) => {
    const button = el(
      "button",
      { type: "button", "aria-pressed": String(value === mode) },
      value === "spot" ? "Spot · Kuru" : "Perp · Perpl",
    );
    button.addEventListener("click", () => setMode(value));
    modes.append(button);
    return button;
  });
  function setMode(next: "spot" | "perp") {
    if (next === "perp" && !perp) return;
    mode = next;
    for (const [index, button] of modeButtons.entries())
      button.setAttribute(
        "aria-pressed",
        String((index === 0 ? "spot" : "perp") === mode),
      );
    spotPane.hidden = mode !== "spot";
    perpPane.hidden = mode !== "perp";
    if (mode === "perp" && perp && !perpMounted) {
      perpMounted = true;
      perpPane.append(perpTicket(input.postId, perp.signal, perp.route));
    }
    venue.replaceChildren(
      mode === "spot"
        ? el("img", {
            class: "swap-kuru",
            src: assetUrl("brand/kuru.png"),
            alt: "Kuru",
            width: "52",
            height: "13",
          })
        : el("b", { class: "perp-venue" }, "Perpl"),
    );
    const side = perp?.route.side;
    buy.textContent =
      mode === "spot"
        ? "⇄ Buy"
        : side === "short"
          ? "⇄ Short"
          : side === "long"
            ? "⇄ Long"
            : "⇄ Trade";
  }

  spotPane.append(
    el(
      "div",
      { class: "swap-row" },
      sides,
      el(
        "span",
        { class: "swap-row-end" },
        el(
          "span",
          { class: "swap-chain-pill" },
          el("img", {
            class: "swap-chain",
            src: assetUrl("brand/monad.png"),
            alt: "Monad",
            width: "22",
            height: "22",
          }),
          network,
        ),
      ),
    ),
    el(
      "label",
      { class: "swap-box swap-pay" },
      el("span", { class: "swap-label" }, "You pay"),
      el("div", { class: "swap-line" }, amount, payToken),
      payUsd,
    ),
    el("span", { class: "swap-arrow", "aria-hidden": "true" }, "↓"),
    el(
      "div",
      { class: "swap-box" },
      el("span", { class: "swap-label" }, "You receive"),
      el("div", { class: "swap-line" }, receiveAmount, receiveToken),
      receiveUsd,
    ),
    meta,
    creatorLine,
    status,
    submit,
  );
  panel.append(
    modes,
    risk.line,
    spotPane,
    perpPane,
    el(
      "footer",
      { class: "swap-footer" },
      el(
        "span",
        { class: "swap-powered" },
        "Powered by",
        logo(),
        el("i", { class: "swap-powered-sep", "aria-hidden": "true" }),
        venue,
      ),
      safeLink(
        new URL(`/creators/${input.handle}`, appOrigin).href,
        `@${input.handle} record ↗`,
      ),
    ),
  );

  function toggle(open: boolean) {
    panel.hidden = !open;
    if (input.attached) card.hidden = !open;
    buy.hidden = open;
    close.hidden = !open;
    buy.setAttribute("aria-expanded", String(open));
    if (open) {
      risk.load();
      update();
      amount.focus({ preventScroll: true });
    } else sequence++;
  }
  buy.addEventListener("click", () => toggle(true));
  close.addEventListener("click", () => toggle(false));
  card.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape" && !panel.hidden)
      toggle(false);
  });

  // Evidence for every card, call or not: token data loads from the asset alone.
  let insights = callInsights({
    postId: input.postId,
    handle: input.handle,
    signal: input.signal,
    asset,
  });
  if (input.attached) {
    card.hidden = true;
    card.append(
      el(
        "header",
        { class: "swap-head" },
        el(
          "div",
          { class: "swap-title" },
          el("strong", {}, `Trade ${asset} with Xtrading`),
        ),
        close,
      ),
      insights,
      panel,
    );
  } else card.append(header, insights, panel);
  renderTokens();
  setMode("spot");
  const control: TradeControl = {
    setSignal(signal) {
      // Swap in the classified call check unless the user already opened it.
      if ((insights as HTMLDetailsElement).open) return;
      const next = callInsights({
        postId: input.postId,
        handle: input.handle,
        signal,
        asset,
      });
      insights.replaceWith(next);
      insights = next;
    },
    enablePerp(signal, route) {
      perp = { signal, route };
      modes.hidden = false;
      setMode("perp");
    },
  };
  controls.set(card, control);
  if (input.perp) control.enablePerp(input.perp.signal, input.perp.route);
  return { card, buy };
}

/** Supported cashtags in a post's own text: $ETH, $BTC, $MON and their wrapped forms. */
export function cashtagMarket(article: HTMLElement): SwapMarket | null {
  const map: Record<string, SwapMarket> = {
    ETH: "WETH",
    WETH: "WETH",
    BTC: "WBTC",
    WBTC: "WBTC",
    CBBTC: "WBTC",
    MON: "MON",
  };
  const text = article.querySelector('[data-testid="tweetText"]');
  for (const link of text?.querySelectorAll("a") ?? []) {
    const tag = link.textContent?.trim().toUpperCase() ?? "";
    if (tag.startsWith("$") && map[tag.slice(1)])
      return map[tag.slice(1)] ?? null;
  }
  return null;
}
