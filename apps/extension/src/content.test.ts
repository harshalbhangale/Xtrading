// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { heuristicSignal } from "../../../packages/integrations/src/signals";

vi.mock("./drawer", () => ({
  loadInsights: vi.fn().mockResolvedValue(null),
  openDrawer: vi.fn(),
}));

const recorded = {
  handle: "alice",
  identity: { status: "bound", xUserId: "123" },
  stake: { status: "active", chainId: 10143, symbol: "mUSDC" },
  observedAt: "2026-10-12T08:00:00.000Z",
};
const unavailable = {
  ...recorded,
  identity: { status: "unavailable" },
  stake: { status: "unavailable", chainId: 10143 },
};
let sendMessage = vi.fn<(message: { type: string }) => Promise<unknown>>();
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const badgeText = () =>
  document.querySelector(".cmb-badge-host")?.shadowRoot?.textContent ?? "";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/home");
  document.body.innerHTML = `<article data-testid="tweet">
    <div data-testid="User-Name"><a href="https://x.com/alice/status/123"><time>now</time></a></div>
    <div data-testid="tweetText">buy $ETH</div>
  </article>`;
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("CMB_APP_ORIGIN", "https://tradepostapp.vercel.app");
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
    fn();
    return 1;
  });
  vi.stubGlobal(
    "MutationObserver",
    class {
      observe() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe(target: Element) {
        this.callback([{ target, isIntersecting: true }]);
      }
      unobserve() {}
    },
  );
  sendMessage = vi.fn(async ({ type }) =>
    type === "creator-evidence" ? recorded : null,
  );
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it("renders independent binding and active-stake chips", async () => {
  await import("./content");
  await flush();
  expect(badgeText()).toContain("✓ Verified");
  expect(badgeText()).toContain("◆ Staked");
});

it("does not attach a delayed creator binding to a recycled post", async () => {
  let resolveEvidence: (value: unknown) => void = () => {};
  const pending = new Promise((resolve) => {
    resolveEvidence = resolve;
  });
  sendMessage.mockImplementation(async ({ type }) =>
    type === "creator-evidence" ? pending : null,
  );
  await import("./content");
  document
    .querySelector("a")
    ?.setAttribute("href", "https://x.com/bob/status/456");
  resolveEvidence(recorded);
  await flush();
  expect(document.querySelector(".cmb-badge-host")).toBeNull();
});

it("does not attach a delayed trade signal to a recycled post", async () => {
  let resolveSignal: (value: unknown) => void = () => {};
  const pending = new Promise((resolve) => {
    resolveSignal = resolve;
  });
  sendMessage.mockImplementation(async ({ type }) =>
    type === "classify-post" ? pending : recorded,
  );
  await import("./content");
  document
    .querySelector("a")
    ?.setAttribute("href", "https://x.com/bob/status/456");
  resolveSignal({
    signal: heuristicSignal({
      handle: "alice",
      postId: "123",
      text: "buy $ETH",
    }),
    route: { status: "unavailable", reason: "No market" },
    llm: "unavailable",
  });
  await flush();
  expect(document.querySelector(".cmb-signal-host")).toBeNull();
});

it("removes previous stake claims when the next evidence read is unavailable", async () => {
  await import("./content");
  await flush();
  expect(badgeText()).toContain("◆ Staked");
  sendMessage.mockImplementation(async ({ type }) =>
    type === "creator-evidence" ? unavailable : null,
  );
  await vi.advanceTimersByTimeAsync(60000);
  await flush();
  expect(document.querySelector(".cmb-badge-host")).toBeNull();
  expect(
    sendMessage.mock.calls.filter(([m]) => m.type === "creator-evidence"),
  ).toHaveLength(2);
});
