// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { heuristicSignal } from "../../../packages/integrations/src/signals";
import { openDrawer } from "./drawer";

vi.mock("./drawer", () => ({ openDrawer: vi.fn() }));

const response = (text: string) => ({
  signal: heuristicSignal({
    handle: "alice",
    postId: "123",
    now: new Date("2026-10-12T08:00:00Z"),
    text,
  }),
  route: { status: "unavailable", reason: "No market" },
  llm: "unavailable",
});
let sendMessage = vi.fn<(message: { type: string }) => Promise<unknown>>();
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/home");
  document.body.innerHTML = `<article data-testid="tweet">
    <div data-testid="User-Name"><a href="https://x.com/alice/status/123"><time>now</time></a></div>
    <div data-testid="tweetText">buy $ETH</div>
  </article>`;
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
  sendMessage = vi.fn(async () => response("buy $ETH"));
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it("leaves ordinary posts untouched without creator evidence requests", async () => {
  const textNode = document.querySelector('[data-testid="tweetText"]');
  if (textNode) textNode.textContent = "Good morning everyone";
  sendMessage.mockResolvedValue(response("Good morning everyone"));
  await import("./content");
  await flush();
  expect(document.querySelector('[class^="cmb-"]')).toBeNull();
  expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
    "classify-post",
  ]);
  expect(openDrawer).not.toHaveBeenCalled();
});

it("opens a detected call's drawer only after clicking its entry point", async () => {
  await import("./content");
  await flush();
  const host = document.querySelector(".cmb-signal-host");
  expect(host?.shadowRoot?.textContent).toContain("ETH");
  expect(document.querySelector(".cmb-badge-host")).toBeNull();
  expect(openDrawer).not.toHaveBeenCalled();
  host?.shadowRoot?.querySelector("button")?.click();
  expect(openDrawer).toHaveBeenCalledWith(
    "123",
    response("buy $ETH").signal,
    response("buy $ETH").route,
  );
});

it("does not inject a profile card on profile pages", async () => {
  window.history.replaceState(null, "", "/alice");
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName">Alice</div></div>';
  await import("./content");
  await flush();
  expect(document.querySelector('[class^="cmb-"]')).toBeNull();
  expect(sendMessage).not.toHaveBeenCalled();
});

it.each([null, { signal: { isCall: true } }])(
  "leaves posts untouched when classification is invalid: %j",
  async (value) => {
    sendMessage.mockResolvedValue(value);
    await import("./content");
    await flush();
    expect(document.querySelector(".cmb-signal-host")).toBeNull();
  },
);

it("does not attach a delayed trade signal to a recycled post", async () => {
  let resolveSignal: (value: unknown) => void = () => {};
  sendMessage.mockReturnValue(
    new Promise((resolve) => {
      resolveSignal = resolve;
    }),
  );
  await import("./content");
  document
    .querySelector("a")
    ?.setAttribute("href", "https://x.com/bob/status/456");
  resolveSignal(response("buy $ETH"));
  await flush();
  expect(document.querySelector(".cmb-signal-host")).toBeNull();
});
