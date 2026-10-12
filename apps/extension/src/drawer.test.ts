// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import {
  deriveTradeRoute,
  heuristicSignal,
} from "../../../packages/integrations/src/signals";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://tradepostapp.vercel.app");
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
    .querySelector<HTMLElement>(".cta")
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
