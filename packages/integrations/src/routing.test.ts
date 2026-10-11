import { describe, expect, it } from "vitest";
import { type RouteMarket, resolveTradeRoute } from "./routing";

const asset = "0x0000000000000000000000000000000000000001";
const markets: [RouteMarket, RouteMarket] = [
  {
    instrument: "spot",
    chainId: 10143,
    asset,
    marketId: "spot-demo",
    enabled: true,
  },
  {
    instrument: "perp",
    chainId: 10143,
    asset,
    marketId: "perp-demo",
    enabled: true,
  },
];

describe("explicit call routing", () => {
  it("separates spot selling from perp shorting", () => {
    expect(
      resolveTradeRoute(
        { instrument: "spot", chainId: 10143, asset, side: "sell" },
        markets,
      ),
    ).toMatchObject({ venue: "Kuru", status: "route-only" });
    expect(
      resolveTradeRoute(
        { instrument: "perp", chainId: 10143, asset, side: "short" },
        markets,
      ),
    ).toMatchObject({ venue: "Perpl", status: "route-only" });
    expect(() =>
      resolveTradeRoute(
        { instrument: "spot", chainId: 10143, asset, side: "short" },
        markets,
      ),
    ).toThrow();
    expect(() =>
      resolveTradeRoute({ chainId: 10143, asset, side: "buy" }, markets),
    ).toThrow();
  });
  it("never falls back to another instrument or chain", () => {
    expect(
      resolveTradeRoute(
        { instrument: "perp", chainId: 10143, asset, side: "long" },
        markets.slice(0, 1),
      ),
    ).toEqual({ status: "unavailable" });
    expect(
      resolveTradeRoute(
        { instrument: "spot", chainId: 143, asset, side: "buy" },
        markets,
      ),
    ).toEqual({ status: "unavailable" });
    expect(
      resolveTradeRoute(
        { instrument: "spot", chainId: 10143, asset, side: "buy" },
        [{ ...markets[0], enabled: false }],
      ),
    ).toEqual({ status: "unavailable" });
  });
  it("rejects ambiguous configuration and injected execution settings", () => {
    const request = { instrument: "perp", chainId: 10143, asset, side: "long" };
    expect(() => resolveTradeRoute(request, [...markets, markets[1]])).toThrow(
      "Ambiguous",
    );
    expect(() =>
      resolveTradeRoute({ ...request, leverage: 100 }, markets),
    ).toThrow();
  });
});
