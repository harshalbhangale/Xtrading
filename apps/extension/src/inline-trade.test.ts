// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  deriveTradeRoute,
  heuristicSignal,
} from "../../../packages/integrations/src/signals";

vi.mock("./drawer", () => ({
  loadInsights: vi.fn().mockResolvedValue(null),
  postAttachments: () => document.createElement("div"),
}));
const signal = heuristicSignal({
  postId: "123",
  handle: "alice",
  text: "buy $MON",
  now: new Date(),
});
let sendMessage = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
  sendMessage = vi.fn().mockResolvedValue(null);
  vi.stubGlobal("chrome", { runtime: { id: "extension", sendMessage } });
});
afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("never opens wallet review for invalid amounts and carries an explicit network", async () => {
  const { inlineTrade } = await import("./inline-trade");
  const card = inlineTrade(signal, deriveTradeRoute(signal, []));
  document.body.append(card);
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  card.querySelector<HTMLElement>(".inline-buy")?.click();
  const input = card.querySelector<HTMLInputElement>("input.inline-amount");
  if (!input) throw new Error("Missing input");
  input.value = "1e6";
  input.dispatchEvent(new Event("input"));
  card.querySelector<HTMLElement>(".inline-submit")?.click();
  expect(open).not.toHaveBeenCalled();
  input.value = "10";
  input.dispatchEvent(new Event("input"));
  card.querySelector<HTMLElement>(".inline-submit")?.click();
  const url = new URL(String(open.mock.calls[0]?.[0]));
  expect(url.origin).toBe("https://xtradingnow.xyz");
  expect(url.pathname).toBe("/trade/inline");
  expect(url.searchParams.get("chainId")).toBe("10143");
  expect(url.searchParams.get("postId")).toBe("123");
  expect(url.searchParams.get("amount")).toBe("10");
  open.mockRestore();
});
it("discards an in-flight quote after a network switch", async () => {
  const { inlineTrade } = await import("./inline-trade");
  let resolve: (value: unknown) => void = () => {};
  sendMessage.mockImplementation(
    (m: { type: string; payload?: { amount: string } }) =>
      m.type === "inline-quote" && m.payload?.amount === "1000000"
        ? new Promise((r) => {
            resolve = r;
          })
        : Promise.resolve(null),
  );
  const card = inlineTrade(signal, deriveTradeRoute(signal, []));
  document.body.append(card);
  card.querySelector<HTMLElement>(".inline-buy")?.click();
  const input = card.querySelector<HTMLInputElement>(".inline-amount");
  const network = card.querySelector<HTMLSelectElement>(
    'select[aria-label="Trading network"]',
  );
  if (!input || !network) throw new Error("Missing controls");
  input.value = "1";
  input.dispatchEvent(new Event("input"));
  await vi.advanceTimersByTimeAsync(400);
  network.value = "143";
  network.dispatchEvent(new Event("change"));
  resolve({
    chainId: 10143,
    market: "MON",
    side: "buy",
    amount: "1000000",
    input: { symbol: "USDC", decimals: 6 },
    output: { symbol: "MON", decimals: 18 },
    expectedOutput: "999000000000000000000",
    price: "999",
    filled: true,
    observedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 15000).toISOString(),
    blockNumber: "123",
    kind: "indicative",
    note: "",
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(card.querySelector(".inline-output")?.textContent).toBe("—");
  expect(card.querySelector(".inline-price")?.textContent).not.toContain("999");
});

it("expires indications and shows net output when a registered creator fee is selected", async () => {
  const { inlineTrade } = await import("./inline-trade");
  sendMessage.mockImplementation(
    async (m: { type: string; payload?: Record<string, unknown> }) =>
      m.type === "creator-payout"
        ? {
            creator: {
              xUserId: "1",
              handle: "alice",
              wallet: "0x000000000000000000000000000000000000beef",
              enabled: true,
            },
            mainnetFeesEnabled: true,
            bps: 50,
          }
        : {
            ...m.payload,
            input: { symbol: "USDC", decimals: 6 },
            output: { symbol: "MON", decimals: 18 },
            expectedOutput: "100000000000000000000",
            price: "0.01",
            filled: false,
            observedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15000).toISOString(),
            blockNumber: "1",
            kind: "indicative",
            note: "",
          },
  );
  const card = inlineTrade(signal, deriveTradeRoute(signal, []));
  document.body.append(card);
  await Promise.resolve();
  await Promise.resolve();
  card.querySelector<HTMLElement>(".inline-buy")?.click();
  const network = card.querySelector<HTMLSelectElement>(
    'select[aria-label="Trading network"]',
  );
  const amount = card.querySelector<HTMLInputElement>(".inline-amount");
  const fee = card.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!network || !amount || !fee) throw new Error("Missing form");
  network.value = "143";
  network.dispatchEvent(new Event("change"));
  amount.value = "1";
  amount.dispatchEvent(new Event("input"));
  fee.checked = true;
  fee.dispatchEvent(new Event("change"));
  await vi.advanceTimersByTimeAsync(400);
  expect(card.querySelector(".inline-output")?.textContent).toBe("≈ 99.5");
  await vi.advanceTimersByTimeAsync(15000);
  expect(card.querySelector(".inline-output")?.textContent).toBe("—");
  expect(
    card.querySelector(".inline-note[role=status]")?.textContent,
  ).toContain("expired");
  network.value = "10143";
  network.dispatchEvent(new Event("change"));
  expect(fee.checked).toBe(false);
  expect(fee.disabled).toBe(true);
});
