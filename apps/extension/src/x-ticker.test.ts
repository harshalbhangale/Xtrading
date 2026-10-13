// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The attached panel loads quotes/insights through the background; keep them silent here.
vi.mock("./dom", async (original) => ({
  ...(await original<typeof import("./dom")>()),
  send: vi.fn().mockResolvedValue(null),
}));

const xCard = (symbol: string, price = "$2,511.29") => `
  <article data-testid="tweet">
    <div data-testid="tweetText">gm</div>
    <div class="x-container"><nav><div data-testid="ScrollSnap-List">
      <a role="link" href="https://x.com/search?q=%24${symbol}">
        <div class="row" style="display:flex;flex-direction:row">
          <span>Ethereum</span><span>${symbol}</span><span>${price}</span><span>−1.30%</span>
          <svg></svg>
        </div>
      </a>
    </div></nav></div>
  </article>`;

beforeEach(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
});
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("findXTicker", () => {
  it("finds supported cashtag cards and maps them to Kuru markets", async () => {
    const { findXTicker } = await import("./x-ticker");
    document.body.innerHTML = xCard("ETH");
    const article = document.querySelector("article") as HTMLElement;
    expect(findXTicker(article)).toMatchObject({
      symbol: "ETH",
      market: "WETH",
      asset: "ETH",
    });
    document.body.innerHTML = xCard("CBBTC", "$83,414.62");
    expect(
      findXTicker(document.querySelector("article") as HTMLElement)?.market,
    ).toBe("WBTC");
  });
  it("ignores unsupported tokens and cards without a price", async () => {
    const { findXTicker } = await import("./x-ticker");
    document.body.innerHTML = xCard("SOL", "$150.10");
    expect(
      findXTicker(document.querySelector("article") as HTMLElement),
    ).toBeNull();
    document.body.innerHTML = xCard("ETH", "soon");
    expect(
      findXTicker(document.querySelector("article") as HTMLElement),
    ).toBeNull();
  });
});

describe("attachToXTicker", () => {
  it("puts Buy inside X's card and the panel below it, once", async () => {
    const { attachToXTicker } = await import("./x-ticker");
    document.body.innerHTML = xCard("ETH");
    const article = document.querySelector("article") as HTMLElement;
    const post = { postId: "1", handle: "kol" };
    expect(attachToXTicker(article, post)).toBe(true);
    expect(attachToXTicker(article, post)).toBe(true);
    expect(article.querySelectorAll(".cmb-xticker-host")).toHaveLength(1);
    const buyHost = article.querySelector(".cmb-xbuy-host") as HTMLElement;
    expect(buyHost.parentElement).toBe(article.querySelector("a"));
    expect(article.querySelector(".row .cmb-xbuy-host")).toBeNull();
    expect(buyHost.style.position).toBe("absolute");
    expect(buyHost.style.right).toBe("12px");
    expect(buyHost.style.bottom).toBe("10px");
    const container = article.querySelector(".x-container");
    expect(container?.nextElementSibling?.classList).toContain(
      "cmb-xticker-host",
    );
  });

  it("opens the panel without letting X's link navigate", async () => {
    const { attachToXTicker } = await import("./x-ticker");
    document.body.innerHTML = xCard("MON", "$0.0248");
    const article = document.querySelector("article") as HTMLElement;
    attachToXTicker(article, { postId: "2", handle: "kol" });
    const navigate = vi.fn();
    article.querySelector("a")?.addEventListener("click", navigate);
    const buy = article
      .querySelector(".cmb-xbuy-host")
      ?.shadowRoot?.querySelector<HTMLButtonElement>(".inline-buy");
    const panel = article
      .querySelector(".cmb-xticker-host")
      ?.shadowRoot?.querySelector<HTMLElement>(".inline-card");
    expect(panel?.hidden).toBe(true);
    buy?.click();
    expect(panel?.hidden).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("restores the button when X re-renders the card contents", async () => {
    const { attachToXTicker } = await import("./x-ticker");
    document.body.innerHTML = xCard("ETH");
    const article = document.querySelector("article") as HTMLElement;
    attachToXTicker(article, { postId: "3", handle: "kol" });
    article.querySelector(".cmb-xbuy-host")?.remove();
    attachToXTicker(article, { postId: "3", handle: "kol" });
    expect(article.querySelectorAll(".cmb-xbuy-host")).toHaveLength(1);
  });
});
