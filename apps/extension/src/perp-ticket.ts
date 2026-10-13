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
import {
  type PerplChainId,
  type PerplWalletStep,
  signPerplSteps,
} from "./perp-wallet";
import { hasBrowserWallet, walletRequest } from "./wallet";

const errors: Record<string, string> = {
  leverage_above_cap: "Leverage is above the app cap.",
  leverage_above_market_max: "Leverage is above this market's maximum.",
  slippage_above_market_max: "Slippage is above this market's maximum.",
  size_above_cap: "Size is above the cap.",
  collateral_above_cap: "Margin is above the mainnet cap. Use a smaller size.",
  perpl_mainnet_disabled: "Perpl mainnet is switched off on this server.",
  market_closed: "Market is closed.",
  market_unpriced: "No mark price right now. Try again shortly.",
  collateral_insufficient: "Not enough AUSD in your wallet for this order.",
  perpl_account_frozen: "Your Perpl account is frozen.",
  perpl_exchange_mismatch: "Perpl's exchange address changed. Not sending.",
  transaction_pending: "Transaction not found yet.",
  transaction_not_from_wallet: "That transaction was not sent by your wallet.",
  order_not_found: "No order from your account in that transaction.",
  perpl_unavailable: "Perpl is unavailable. Try again.",
  rate_limited: "Too many requests. Wait a moment.",
};
const explain = (code: string) => errors[code] ?? code.replaceAll("_", " ");
type Call<T> = { result?: T; failure?: string } | null;
type Prepared = { wallet: string; requestId: string; steps: PerplWalletStep[] };
type Confirmed = {
  status: string;
  filledSize?: string;
  averagePrice?: string | null;
  message: string;
};

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
      maxSize: z
        .string()
        .regex(/^[0-9]+(\.[0-9]+)?$/)
        .nullable(),
      maxCollateral: z
        .string()
        .regex(/^[0-9]+(\.[0-9]+)?$/)
        .nullable()
        .optional(),
    }),
  }),
});

const networks = {
  10143: { label: "testnet", explorer: "https://testnet.monadvision.com" },
  143: { label: "mainnet · real AUSD", explorer: "https://monadvision.com" },
} as const;

/**
 * Trader-style perp ticket on the X card. With a browser wallet (MetaMask, Rabby)
 * the order is prepared and signed right here on X, step by step, on the user's
 * own Perpl account. Without one it opens the Xtrading (Privy) window. Testnet
 * unless the user picks mainnet; mainnet only works when the server enables it.
 */
export function perpTicket(
  postId: string,
  signal: PostSignal,
  route: Extract<TradeRoute, { status: "available" }>,
) {
  const network = el(
    "select",
    { class: "swap-network", "aria-label": "Perpl network" },
    el("option", { value: "10143" }, "Monad testnet"),
    el("option", { value: "143" }, "Monad mainnet"),
  ) as HTMLSelectElement;
  const body = el("div", {});
  const root = el(
    "div",
    { class: "ticket" },
    el("div", { class: "ticket-row" }, el("span", {}, "Network"), network),
    body,
  );
  let sequence = 0;
  function load(chainId: PerplChainId) {
    const current = ++sequence;
    body.replaceChildren(el("p", { class: "note" }, "Loading market…"));
    void send<unknown>({ type: "markets", perplChainId: chainId }).then(
      (raw) => {
        if (current !== sequence) return;
        const parsed = marketsSchema.safeParse(raw);
        // Market IDs differ per network; the detected call's market is matched by
        // ID on testnet (where it was routed) and by symbol on mainnet.
        const market = parsed.data?.perpl.markets.find((m) =>
          chainId === 10143
            ? String(m.marketId) === route.marketId
            : m.symbol === route.market,
        );
        const disabled =
          (raw as { perpl?: { status?: unknown } } | null)?.perpl?.status ===
          "disabled";
        if (!parsed.success || !market?.open) {
          body.replaceChildren(
            el(
              "p",
              { class: "note" },
              disabled
                ? "Perpl mainnet is switched off on this server."
                : parsed.success && chainId === 143
                  ? `No open Perpl mainnet market for ${route.market}.`
                  : "Perpl market data unavailable. Try again shortly.",
            ),
          );
          return;
        }
        render(
          body,
          chainId,
          postId,
          signal,
          route,
          market,
          parsed.data.perpl.limits,
        );
      },
    );
  }
  network.addEventListener("change", () =>
    load(network.value === "143" ? 143 : 10143),
  );
  load(10143);
  return root;
}

function render(
  root: HTMLElement,
  chainId: PerplChainId,
  postId: string,
  signal: PostSignal,
  route: Extract<TradeRoute, { status: "available" }>,
  market: z.infer<typeof marketSchema>,
  limits: z.infer<typeof marketsSchema>["perpl"]["limits"],
) {
  let side: "long" | "short" = route.side === "short" ? "short" : "long";
  // Perpl's market maximum and the app's cap both apply; the lower one wins.
  const maxLeverage = Math.min(
    limits.maxLeverage,
    market.marketMaxLeverage ?? limits.maxLeverage,
  );
  let leverage = Math.min(Math.max(signal.leverage ?? 2, 1), maxLeverage);
  let unit: "base" | "usd" = "base";
  const mark = market.quote.mark ? BigInt(market.quote.mark) : null;
  const maxUnits = limits.maxSize
    ? toUnits(limits.maxSize, market.sizeDecimals)
    : null;
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
    if (busy || !current) return;
    const order = current;
    void hasBrowserWallet().then((present) =>
      present ? placeOnX(order) : openWalletWindow(href),
    );
  });
  const status = el("p", { class: "note", "aria-live": "polite" });
  let busy = false;
  const slippageBps = Math.min(100, market.maxSlippageBps ?? 100);
  let current: Record<string, unknown> | null = null;

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
    status,
    el(
      "p",
      { class: "note" },
      `Max ${limits.maxSize ? `${limits.maxSize} ${market.symbol}` : `${limits.maxCollateral ?? "—"} AUSD margin`}, ${maxLeverage}x · ${(slippageBps / 100).toFixed(2)}% max slippage · estimates before fees and funding · ${networks[chainId].label} · not advice`,
    ),
  );

  // The app's perp window, prefilled and set to review on open; Privy signs there.
  function walletWindowUrl(order: Record<string, unknown>) {
    const url = new URL("/trade/perp", appOrigin);
    url.searchParams.set("chainId", String(chainId));
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
  /** Prepare for the connected wallet, sign each step in it, read the fill back. */
  async function placeOnX(order: Record<string, unknown>) {
    busy = true;
    go.setAttribute("aria-disabled", "true");
    const say = (...parts: (string | Node)[]) =>
      status.replaceChildren(...parts);
    try {
      say("Connect your wallet…");
      const [account] = await walletRequest<string[]>("eth_requestAccounts");
      if (!account) throw new Error("No wallet account connected.");
      say("Checking order…");
      const prepared = await send<Call<Prepared>>({
        type: "perp-prepare",
        wallet: account,
        order,
      });
      if (!prepared?.result)
        throw new Error(explain(prepared?.failure ?? "unavailable"));
      const hash = await signPerplSteps({
        chainId,
        wallet: prepared.result.wallet,
        steps: prepared.result.steps,
        onStatus: (text) => say(text),
      });
      say("Reading the result from chain…");
      let confirmed: Call<Confirmed> = null;
      for (let attempt = 0; attempt < 5 && root.isConnected; attempt++) {
        confirmed = await send<Call<Confirmed>>({
          type: "perp-confirm",
          wallet: prepared.result.wallet,
          order: {
            chainId,
            transactionHash: hash,
            requestId: prepared.result.requestId,
            sourcePostId: order.sourcePostId ?? null,
          },
        });
        if (confirmed?.failure !== "transaction_pending") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const link = el(
        "a",
        {
          href: `${networks[chainId].explorer}/tx/${hash}`,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "View transaction ↗",
      );
      const result = confirmed?.result;
      if (!result)
        return say(
          `Sent from your wallet; the result could not be read back (${explain(confirmed?.failure ?? "unavailable")}). `,
          link,
        );
      const filled =
        result.filledSize && result.filledSize !== "0"
          ? `${fromUnits(BigInt(result.filledSize), market.sizeDecimals)} ${market.symbol}${result.averagePrice ? ` @ ${usd(BigInt(result.averagePrice))}` : ""} · `
          : "";
      say(
        el("strong", {}, `${result.status.replace("-", " ")} ✓ `),
        filled,
        result.message,
        " ",
        link,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wallet request failed.";
      say(
        /reject|denied|4001/i.test(message)
          ? "Cancelled in your wallet. Nothing further was sent."
          : message,
      );
    } finally {
      busy = false;
      update();
    }
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
    current = ready
      ? {
          chainId,
          marketId: market.marketId,
          side,
          size: fromUnits(units ?? 0n, market.sizeDecimals),
          leverage,
          slippageBps,
          sourcePostId: /^[0-9]{1,30}$/.test(postId) ? postId : null,
        }
      : null;
    go.className = `ticket-go ${side}${ready ? "" : " disabled"}`;
    go.textContent = ready
      ? `${label} · sign with your wallet`
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
