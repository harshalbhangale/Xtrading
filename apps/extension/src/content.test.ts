// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  deriveTradeRoute,
  heuristicSignal,
} from "../../../packages/integrations/src/signals";
import { loadInsights, openDrawer } from "./drawer";

vi.mock("./drawer", () => ({
  openDrawer: vi.fn(),
  loadInsights: vi.fn().mockResolvedValue(null),
}));

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
let mutation: () => void = () => {};
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingtoday.vercel.app");
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
      constructor(callback: () => void) {
        mutation = callback;
      }
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
  vi.stubGlobal("chrome", { runtime: { id: "test-extension", sendMessage } });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it("leaves ordinary posts by unverified authors untouched", async () => {
  const textNode = document.querySelector('[data-testid="tweetText"]');
  if (textNode) textNode.textContent = "Good morning everyone";
  sendMessage.mockResolvedValue(response("Good morning everyone"));
  await import("./content");
  await flush();
  expect(document.querySelector('[class^="cmb-"]')).toBeNull();
  // One cached identity lookup for the author's badge, plus classification. No panels.
  expect(
    sendMessage.mock.calls.map(([message]) => message.type).sort(),
  ).toEqual(["classify-post", "creator-evidence"]);
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

it("shows one honest creator card on profile pages without adding feed panels", async () => {
  window.history.replaceState(null, "", "/alice");
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName">Alice</div></div>';
  await import("./content");
  await flush();
  expect(document.querySelectorAll(".cmb-profile-host")).toHaveLength(1);
  expect(
    document.querySelector(".cmb-profile-host")?.shadowRoot?.textContent,
  ).toContain("service unavailable");
  // Only the header badge's identity lookup and the saved-handle read for Follow KOL; an unverified creator gets no badge.
  expect(sendMessage.mock.calls.map(([message]) => message.type)).toEqual([
    "creator-evidence",
    "watchlist",
  ]);
  expect(document.querySelector(".cmb-profile-badge-host")).toBeNull();
});

const bound = {
  handle: "alice",
  identity: {
    status: "bound",
    xUserId: "1",
    wallet: "0x716ae38ccd2c044d33b9aa040a2a6901f6ffd964",
    linkedAt: "2026-10-11T19:55:35.699Z",
  },
  stake: { status: "unavailable", chainId: 10143 },
  observedAt: "2026-10-12T08:00:00.000Z",
};
const byType = (signal: unknown) => async (message: { type: string }) =>
  message.type === "creator-evidence" ? bound : signal;

it("badges a verified author's post quietly, without a tooltip", async () => {
  sendMessage.mockImplementation(byType(response("buy $ETH")));
  await import("./content");
  await flush();
  const root = document.querySelector(".cmb-badge-host")?.shadowRoot;
  expect(root?.querySelector(".xt-badge.xt-static")).not.toBeNull();
  expect(root?.querySelector(".xt-tooltip")).toBeNull();
  expect(root?.querySelector(".xt-badge")?.hasAttribute("tabindex")).toBe(
    false,
  );
});

it("puts an explained badge beside a verified creator's profile name", async () => {
  window.history.replaceState(null, "", "/alice");
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName"><span>Alice</span></div></div>';
  sendMessage.mockImplementation(byType(null));
  await import("./content");
  await flush();
  const hosts = document.querySelectorAll(".cmb-profile-badge-host");
  expect(hosts).toHaveLength(1);
  expect(hosts[0]?.previousElementSibling?.textContent).toBe("Alice");
  expect(hosts[0]?.shadowRoot?.textContent).toContain("XTrading Verified");
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

it("rejects a response for a different post", async () => {
  const value = response("buy $ETH");
  value.signal.postId = "456";
  sendMessage.mockResolvedValue(value);
  await import("./content");
  await flush();
  expect(document.querySelector(".cmb-signal-host")).toBeNull();
});

it("keeps address-only posts out of scored calls and disables unknown token trades", async () => {
  const text = "CA: 39fzweMMY4DRAgBQN61jbMGRoa2RBFTjAY3Vg95Epump";
  const textNode = document.querySelector('[data-testid="tweetText"]');
  if (textNode) textNode.textContent = text;
  sendMessage.mockResolvedValue(response(text));
  await import("./content");
  await flush();
  const shadow = document.querySelector(".cmb-signal-host")?.shadowRoot;
  expect(shadow?.textContent).toContain("Token address shared");
  expect(
    shadow?.querySelector('a[href="https://x.com/alice/status/123"]'),
  ).not.toBeNull();
  expect(shadow?.querySelectorAll("button:disabled")).toHaveLength(2);
  expect(response(text).signal.isCall).toBe(false);
});

it("expands buy and sell inline without opening a sidebar", async () => {
  const signal = response("buy $ETH").signal;
  sendMessage.mockResolvedValue({
    signal,
    route: deriveTradeRoute(signal, []),
    llm: "unavailable",
  });
  await import("./content");
  await flush();
  const root = document.querySelector(".cmb-signal-host")?.shadowRoot;
  expect(root?.querySelector(".inline-card")).not.toBeNull();
  expect(root?.querySelector<HTMLElement>(".inline-panel")?.hidden).toBe(true);
  root?.querySelector<HTMLElement>(".inline-buy")?.click();
  expect(root?.querySelector<HTMLElement>(".inline-panel")?.hidden).toBe(false);
  expect(root?.querySelectorAll(".inline-sides button")).toHaveLength(2);
  expect(openDrawer).not.toHaveBeenCalled();
});

it("uses X's ticker card instead of a second card when the post has one", async () => {
  document.querySelector("article")?.insertAdjacentHTML(
    "beforeend",
    `<div class="x-container"><nav><div data-testid="ScrollSnap-List">
      <a role="link"><div style="display:flex"><span>Ethereum</span><span>ETH</span><span>$2,511.29</span><svg></svg></div></a>
    </div></nav></div>`,
  );
  const signal = response("buy $ETH").signal;
  sendMessage.mockResolvedValue({
    signal,
    route: deriveTradeRoute(signal, []),
    llm: "unavailable",
  });
  await import("./content");
  await flush();
  expect(document.querySelectorAll(".cmb-xticker-host")).toHaveLength(1);
  expect(document.querySelectorAll(".cmb-xbuy-host")).toHaveLength(1);
  expect(
    document.querySelector('.cmb-signal-host[data-inline="true"]'),
  ).toBeNull();
});

it("offers Buy from X's ticker card even when the post is not a call", async () => {
  document.querySelector("article")?.insertAdjacentHTML(
    "beforeend",
    `<div class="x-container"><nav><div data-testid="ScrollSnap-List">
      <a role="link"><div style="display:flex"><span>Monad</span><span>MON</span><span>$0.0248</span><svg></svg></div></a>
    </div></nav></div>`,
  );
  sendMessage.mockResolvedValue(null);
  await import("./content");
  await flush();
  expect(document.querySelectorAll(".cmb-xbuy-host")).toHaveLength(1);
});

it("draws its own Kuru card for a supported cashtag without waiting for classification", async () => {
  const text = document.querySelector('[data-testid="tweetText"]');
  if (text) text.innerHTML = 'Much higher <a href="/search?q=%24ETH">$ETH</a>';
  sendMessage.mockResolvedValue(null);
  await import("./content");
  await flush();
  const root = document.querySelector(".cmb-swap-host")?.shadowRoot;
  expect(root?.querySelector(".swap-title strong")?.textContent).toBe(
    "Ethereum",
  );
  expect(root?.querySelector(".inline-buy")).not.toBeNull();
  expect(document.querySelectorAll(".cmb-swap-host")).toHaveLength(1);
});

it("does not draw a Kuru card for tokens Kuru does not list", async () => {
  const text = document.querySelector('[data-testid="tweetText"]');
  if (text)
    text.innerHTML = 'Early gem <a href="/search?q=%24BATON">$BATON</a>';
  sendMessage.mockResolvedValue(null);
  await import("./content");
  await flush();
  expect(document.querySelector(".cmb-swap-host")).toBeNull();
});

it("restores a card removed by an X rerender without duplicating it", async () => {
  const signal = response("buy $ETH").signal;
  sendMessage.mockResolvedValue({
    signal,
    route: deriveTradeRoute(signal, []),
    llm: "unavailable",
  });
  await import("./content");
  await flush();
  document.querySelector(".cmb-signal-host")?.remove();
  mutation();
  await flush();
  expect(document.querySelectorAll(".cmb-signal-host")).toHaveLength(1);
  mutation();
  await flush();
  expect(document.querySelectorAll(".cmb-signal-host")).toHaveLength(1);
});

it("discards profile evidence if navigation changes before the response", async () => {
  window.history.replaceState(null, "", "/alice");
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName">Alice</div></div>';
  let resolveInsights: (value: null) => void = () => {};
  vi.mocked(loadInsights).mockReturnValueOnce(
    new Promise((resolve) => {
      resolveInsights = resolve;
    }),
  );
  await import("./content");
  window.history.replaceState(null, "", "/bob");
  resolveInsights(null);
  await flush();
  expect(
    document.querySelector(".cmb-profile-host")?.shadowRoot?.textContent,
  ).not.toContain("Creator evidence unavailable");
});

it("places the creator card above the profile tabs", async () => {
  window.history.replaceState(null, "", "/alice");
  document.body.innerHTML = `<div data-testid="primaryColumn">
    <div data-testid="UserName">Alice</div>
    <div data-testid="UserDescription">Bio</div>
    <div role="tablist"><div role="tab">Posts</div></div>
  </div>`;
  await import("./content");
  await flush();
  const host = document.querySelector(".cmb-profile-host");
  expect(host?.nextElementSibling?.getAttribute("role")).toBe("tablist");
  const actions = host?.shadowRoot?.querySelector(".card-actions");
  expect(actions?.querySelector(".cta")?.textContent).toBe("Open record ↗");
  expect(actions?.querySelector(".card-toggle")?.textContent).toBe(
    "Show details",
  );
});

it("loads expanded creator evidence only after the Expand button is clicked", async () => {
  window.history.replaceState(null, "", "/alice");
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName">Alice</div></div>';
  await import("./content");
  await flush();
  expect(
    sendMessage.mock.calls.some(
      ([message]) => message.type === "creator-overview",
    ),
  ).toBe(false);
  const button = document
    .querySelector(".cmb-profile-host")
    ?.shadowRoot?.querySelector<HTMLButtonElement>(
      'button[aria-controls="creator-overview"]',
    );
  button?.click();
  await flush();
  expect(button?.getAttribute("aria-expanded")).toBe("true");
  expect(
    sendMessage.mock.calls.some(
      ([message]) => message.type === "creator-overview",
    ),
  ).toBe(true);
  button?.click();
  expect(button?.getAttribute("aria-expanded")).toBe("false");
});

it("treats an invalidated extension context as no answer instead of throwing", async () => {
  const { send } = await import("./dom");
  sendMessage.mockImplementation(() => {
    throw new Error("Extension context invalidated.");
  });
  await expect(send({ type: "x" })).resolves.toBeNull();
  vi.stubGlobal("chrome", { runtime: { sendMessage } });
  await expect(send({ type: "x" })).resolves.toBeNull();
});

it("does not insert temporary profile badges for missing identity evidence", async () => {
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName"><span>Alice</span></div></div>';
  const { addProfileBadge } = await import("./creator-badge");
  const name = document.querySelector('[data-testid="UserName"]');
  const span = name?.querySelector("span");
  if (!name || !span) throw new Error("Missing fixture");
  const append = vi.spyOn(name, "append");
  const after = vi.spyOn(span, "after");
  for (let i = 0; i < 5; i++) await addProfileBadge("alice");
  expect(append).not.toHaveBeenCalled();
  expect(after).not.toHaveBeenCalled();
  expect(sendMessage).toHaveBeenCalledTimes(1);
});

it("removes a profile badge when refreshed identity evidence is unavailable", async () => {
  document.body.innerHTML =
    '<div data-testid="primaryColumn"><div data-testid="UserName"><span>Alice</span></div></div>';
  sendMessage.mockResolvedValue(bound);
  const { addProfileBadge } = await import("./creator-badge");
  await addProfileBadge("alice");
  expect(document.querySelector(".cmb-profile-badge-host")).not.toBeNull();
  sendMessage.mockResolvedValue(null);
  await vi.advanceTimersByTimeAsync(60001);
  await addProfileBadge("alice");
  expect(document.querySelector(".cmb-profile-badge-host")).toBeNull();
  // Bound: evidence + reputation; refreshed and unbound: evidence only.
  expect(sendMessage.mock.calls.map(([m]) => m.type)).toEqual([
    "creator-evidence",
    "creator-reputation",
    "creator-evidence",
  ]);
});

it("refreshes feed evidence and discards an expired badge", async () => {
  sendMessage.mockResolvedValue(bound);
  const { addPostBadge } = await import("./creator-badge");
  const article = document.querySelector("article");
  if (!article) throw new Error("Missing fixture");
  await addPostBadge(article, "alice");
  expect(article.querySelector(".cmb-badge-host")).not.toBeNull();
  sendMessage.mockResolvedValue(null);
  await vi.advanceTimersByTimeAsync(60001);
  await addPostBadge(article, "alice");
  expect(article.querySelector(".cmb-badge-host")).toBeNull();
});
