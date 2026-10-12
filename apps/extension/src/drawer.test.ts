// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import {
  deriveTradeRoute,
  heuristicSignal,
} from "../../../packages/integrations/src/signals";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingtoday.vercel.app");
});

import { closeDrawer, openDrawer } from "./drawer";

afterEach(() => {
  closeDrawer();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it("keeps mainnet selection separate from testnet execution", async () => {
  vi.stubGlobal("chrome", {
    runtime: { id: "test", sendMessage: vi.fn().mockResolvedValue(null) },
  });
  const signal = heuristicSignal({
    handle: "alice",
    postId: "123",
    now: new Date(),
    text: "buy $ETH",
  });
  await openDrawer("123", signal, deriveTradeRoute(signal, []));
  const root = document.querySelector(".cmb-drawer-host")?.shadowRoot;
  if (!root) throw new Error("Missing drawer");
  const buttons = Array.from(
    root.querySelectorAll<HTMLButtonElement>(".network-switch button"),
  );
  const mainnet = buttons.find((button) => button.textContent === "Mainnet");
  const testnet = buttons.find((button) => button.textContent === "Testnet");
  if (!mainnet || !testnet) throw new Error("Missing network buttons");
  const trading = root
    .querySelector<HTMLElement>(".ticket")
    ?.closest<HTMLElement>(".section");
  expect(trading?.hidden).toBe(false);
  mainnet.click();
  expect(trading?.hidden).toBe(true);
  expect(mainnet.getAttribute("aria-pressed")).toBe("true");
  expect(root.textContent).toContain(
    "Execution is not ready; no testnet fallback",
  );
  const visibleLink = root.querySelector<HTMLAnchorElement>(
    'a[href*="chainId=143"]',
  );
  expect(visibleLink?.href).toContain("/dashboard/trade?chainId=143");
  testnet.click();
  expect(trading?.hidden).toBe(false);
  expect(root.querySelector('a[href*="chainId=143"]')).toBeNull();
});

it("prices a perp call in the drawer and hands the order to the app", async () => {
  const markets = {
    perpl: {
      markets: [
        {
          marketId: 64,
          symbol: "MON",
          priceDecimals: 5,
          sizeDecimals: 0,
          open: true,
          quote: { mark: "2500", previous: "2400" },
          takerFeePpm: 345,
        },
      ],
      limits: { maxLeverage: 5, maxSize: "10" },
    },
  };
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: vi.fn(async (message: { type: string }) =>
        message.type === "markets" ? markets : null,
      ),
    },
  });
  const signal = heuristicSignal({
    handle: "alice",
    postId: "123",
    now: new Date(),
    text: "long $MON 3x",
  });
  const route = deriveTradeRoute(signal, [
    { marketId: 64, symbol: "MON", open: true },
  ]);
  await openDrawer("123", signal, route);
  const root = document.querySelector(".cmb-drawer-host")?.shadowRoot;
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(root?.textContent).toContain("MON-PERP");
  expect(root?.textContent).toContain("+4.16%");
  const input = root?.querySelector<HTMLInputElement>(".ticket-size input");
  if (!input) throw new Error("Missing size input");
  input.value = "4";
  input.dispatchEvent(new Event("input"));
  const go = root?.querySelector<HTMLAnchorElement>(".ticket-go");
  expect(go?.textContent).toBe("Long 4 MON · 3x in app ↗");
  expect(go?.href).toContain("size=4");
  expect(go?.href).toContain("leverage=3");
  expect(root?.textContent).toContain("$0.1000"); // 4 × $0.025 order value
  input.value = "11";
  input.dispatchEvent(new Event("input"));
  expect(go?.hasAttribute("href")).toBe(false);
  expect(root?.textContent).toContain("Above the 10 MON cap");
});

it("reviews and submits a perp order from X once the extension is connected", async () => {
  const sent: Array<{ type: string; order?: Record<string, unknown> }> = [];
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: vi.fn(
        async (message: { type: string; order?: Record<string, unknown> }) => {
          sent.push(message);
          if (message.type === "markets")
            return {
              perpl: {
                markets: [
                  {
                    marketId: 64,
                    symbol: "MON",
                    priceDecimals: 5,
                    sizeDecimals: 0,
                    open: true,
                    quote: { mark: "2500", previous: null },
                    takerFeePpm: 345,
                    maxSlippageBps: 100,
                    marketMaxLeverage: 3,
                  },
                ],
                limits: { maxLeverage: 5, maxSize: "10" },
              },
            };
          if (message.type === "session-status")
            return { connected: true, handle: "alice" };
          if (message.type === "perp-prepare")
            return { result: { mode: "demo", execution: "Demo: not sent." } };
          if (message.type === "perp-submit")
            return {
              result: { status: "demo", requestId: 1, message: "Validated." },
            };
          return null;
        },
      ),
    },
  });
  const signal = heuristicSignal({
    handle: "alice",
    postId: "123",
    now: new Date(),
    text: "long $MON 5x",
  });
  const route = deriveTradeRoute(signal, [
    { marketId: 64, symbol: "MON", open: true },
  ]);
  await openDrawer("123", signal, route);
  const root = document.querySelector(".cmb-drawer-host")?.shadowRoot;
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  await flush();
  const input = root?.querySelector<HTMLInputElement>(".ticket-size input");
  if (!input) throw new Error("Missing size input");
  input.value = "2";
  input.dispatchEvent(new Event("input"));
  const trade = root?.querySelector<HTMLButtonElement>("button.ticket-go");
  // 5x in the post is capped to the market's 3x maximum.
  expect(trade?.textContent).toBe("Review Long 2 MON · 3x");
  expect(root?.querySelector<HTMLAnchorElement>("a.ticket-go")?.hidden).toBe(
    true,
  );
  trade?.click();
  await flush();
  expect(root?.textContent).toContain("DEMO");
  const confirm = Array.from(
    root?.querySelectorAll<HTMLButtonElement>(".ticket-confirm button") ?? [],
  ).find((b) => b.textContent === "Confirm Long");
  confirm?.click();
  await flush();
  expect(root?.textContent).toContain("Demo validated");
  const submitted = sent.find((m) => m.type === "perp-submit");
  expect(submitted?.order).toEqual({
    marketId: 64,
    side: "long",
    size: "2",
    leverage: 3,
    slippageBps: 100,
    sourcePostId: "123",
    confirm: true,
  });
});

it("prices a Kuru spot call and opens the wallet window over X", async () => {
  vi.stubGlobal("chrome", {
    runtime: {
      id: "test",
      sendMessage: vi.fn(async (message: { type: string }) =>
        message.type === "markets"
          ? {
              kuru: [
                {
                  key: "WETH",
                  base: { symbol: "WETH", decimals: 18 },
                  quote: { symbol: "USDC", decimals: 6 },
                  pricePrecision: "100",
                  takerFeePps: "0",
                  minimumQuote: "10000000",
                  bestBid: "250000",
                  bestAsk: "250000",
                },
              ],
            }
          : null,
      ),
    },
  });
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const signal = heuristicSignal({
    handle: "alice",
    postId: "123",
    now: new Date(),
    text: "buy $ETH",
  });
  await openDrawer("123", signal, deriveTradeRoute(signal, []));
  const root = document.querySelector(".cmb-drawer-host")?.shadowRoot;
  for (let i = 0; i < 10; i++) await Promise.resolve();
  const input = root?.querySelector<HTMLInputElement>(".ticket-size input");
  if (!input) throw new Error("Missing amount input");
  input.value = "25";
  input.dispatchEvent(new Event("input"));
  expect(root?.textContent).toContain("0.01 WETH"); // 25 USDC at $2,500
  const go = root?.querySelector<HTMLButtonElement>("button.ticket-go");
  expect(go?.textContent).toBe("Buy WETH · 25 USDC ↗");
  go?.click();
  const url = new URL(String(open.mock.calls[0]?.[0]));
  expect(url.searchParams.get("amount")).toBe("25");
  expect(url.searchParams.get("popup")).toBe("1");
  expect(url.searchParams.get("market")).toBe("WETH");
});
