// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { formatPrice, readXTicker, sparklineSvg } from "./ticker-price";

function article(html: string) {
  const node = document.createElement("article");
  node.innerHTML = html;
  return node;
}
// Shape of X's cashtag card: a link inside the ScrollSnap list with plain spans.
const card = (symbol: string, price: string, change: string) =>
  `<div data-testid="ScrollSnap-List"><a role="link"><span>Ethereum</span><span>${symbol}</span><span>${price}</span><span>${change}</span><svg></svg></a></div>`;

describe("readXTicker", () => {
  it("reads X's live price and 24h change for the matching symbol", () => {
    expect(
      readXTicker(article(card("ETH", "$2,511.29", "−1.30%")), "ETH"),
    ).toEqual({
      price: "2511.29",
      change24hPct: "-1.30",
      sparkline: [],
      source: "x",
    });
    expect(
      readXTicker(article(card("ETH", "$2,511.29", "+0.84%")), "eth")
        ?.change24hPct,
    ).toBe("0.84");
  });
  it("ignores other symbols and posts without a card", () => {
    expect(readXTicker(article(card("SOL", "$150", "+1%")), "ETH")).toBeNull();
    expect(readXTicker(article("<p>$ETH</p>"), "ETH")).toBeNull();
  });
});

describe("display helpers", () => {
  it("formats prices by magnitude", () => {
    expect(formatPrice("82448.09")).toBe("$82,448.09");
    expect(formatPrice("0.025091")).toBe("$0.025091");
  });
  it("draws a sparkline only with at least two points", () => {
    expect(sparklineSvg(["1"], true)).toBeNull();
    expect(sparklineSvg(["1", "2", "1.5"], false)?.getAttribute("class")).toBe(
      "inline-spark down",
    );
  });
});
