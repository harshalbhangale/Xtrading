import {
  decimalAtoms,
  displayAtoms,
  inlineQuoteSchema,
  publicPayoutSchema,
} from "@call-my-bluff/domain";
import { getAddress } from "viem";
import { appOrigin } from "./config";
import { directTrade } from "./direct-trade";
import { el, poweredBy, safeLink, send } from "./dom";
import {
  formatPrice,
  kuruPrice,
  type LivePrice,
  readXTicker,
  sparklineSvg,
} from "./ticker-price";
import { hasBrowserWallet } from "./wallet";

export type SwapMarket = "MON" | "WETH" | "WBTC";
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

function tokenIcon(asset: Asset | "USDC", size = 40) {
  const colors = {
    ETH: "#627EEA",
    BTC: "#F7931A",
    MON: "#836EF9",
    USDC: "#2775CA",
  };
  const glyph = { ETH: "Ξ", BTC: "₿", MON: "M", USDC: "$" }[asset];
  return el(
    "span",
    {
      class: "swap-icon",
      style: `width:${size}px;height:${size}px;background:${colors[asset]};font-size:${Math.round(size * 0.48)}px`,
      "aria-hidden": "true",
    },
    glyph,
  );
}

function logo() {
  try {
    const url = chrome.runtime.getURL("xtrading-logo.png");
    return el("img", { class: "swap-logo", src: url, alt: "" });
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
  let creatorWallet: `0x${string}` | null = null;

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
  const walletChip = el("span", { class: "swap-wallet", hidden: "" });
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
      creatorWallet = getAddress(payout.data.creator.wallet);
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

  let busy = false;
  const explorer = "https://monadvision.com/tx/";
  /** Mainnet with an injected wallet: trade right here; otherwise secure review. */
  async function tradeInPlace() {
    busy = true;
    submit.setAttribute("disabled", "");
    try {
      const result = await directTrade({
        market: input.market,
        side,
        amount: amount.value,
        slippageBps: 50,
        creator:
          creatorWallet && creatorBps && creatorToggle.checked && side === "buy"
            ? { wallet: creatorWallet, bps: creatorBps as 10 | 50 | 100 | 200 }
            : null,
        onStatus: (text) => {
          status.textContent = text;
        },
      });
      walletChip.textContent = `${result.from.slice(0, 6)}…${result.from.slice(-4)}`;
      walletChip.hidden = false;
      status.replaceChildren(
        `${side === "buy" ? "Bought" : "Sold"} ${asset} on Kuru ✓ `,
        safeLink(`${explorer}${result.hash}`, "View transaction ↗"),
        result.creatorPaid
          ? ` · @${input.handle} was paid in the same transaction.`
          : "",
      );
      amount.value = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Trade failed.";
      status.textContent = /reject|denied|4001/i.test(message)
        ? "Cancelled in your wallet. Nothing was sent."
        : message;
    } finally {
      busy = false;
      update();
    }
  }
  submit.addEventListener("click", async () => {
    const decimals = side === "buy" ? 6 : tokenDecimals(input.market);
    if (busy || !decimalAtoms(amount.value, decimals)) return;
    if (chainId === 143 && (await hasBrowserWallet())) return tradeInPlace();
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
      "Confirm in the Xtrading wallet review. ",
      safeLink(url.href, "Open review ↗"),
    );
  });

  panel.append(
    el(
      "div",
      { class: "swap-row" },
      sides,
      el("span", { class: "swap-row-end" }, walletChip, network),
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
    el(
      "footer",
      { class: "swap-footer" },
      el("span", {}, "Powered by ", logo(), el("b", {}, "Xtrading")),
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
      panel,
    );
  } else card.append(header, panel);
  renderTokens();
  card.append(poweredBy());
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
