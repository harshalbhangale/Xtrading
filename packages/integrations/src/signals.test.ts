import { describe, expect, it } from "vitest";
import { deriveTradeRoute, heuristicSignal, mentionsPerp } from "./signals";

const base = { postId: "123", handle: "Alice" };
const perpl = [
  { marketId: 1, symbol: "BTC", open: true },
  { marketId: 2, symbol: "ETH", open: false },
];

describe("heuristicSignal", () => {
  it("classifies an explicit bullish spot call", () => {
    const s = heuristicSignal({
      ...base,
      text: "Buying $MON here, this sends 🚀",
    });
    expect(s).toMatchObject({
      isCall: true,
      asset: "MON",
      direction: "bullish",
      instrument: "spot",
      confidence: "high",
      handle: "alice",
      source: "heuristic",
    });
  });
  it("detects explicit perp intent and leverage", () => {
    const s = heuristicSignal({ ...base, text: "Opening a 10x short on $BTC" });
    expect(s).toMatchObject({
      instrument: "perp",
      direction: "bearish",
      leverage: 10,
    });
  });
  it("reads go long / short as a perp position, but not a long-term horizon", () => {
    for (const text of [
      "go long on monad this week",
      "go short on ETH at 2400",
    ])
      expect(heuristicSignal({ ...base, text }).instrument).toBe("perp");
    expect(mentionsPerp("holding $MON long term")).toBe(false);
    expect(mentionsPerp("short-term $ETH bounce")).toBe(false);
    expect(mentionsPerp("bullish $MON in the long run")).toBe(false);
  });
  it("keeps a bearish call without perp language on spot", () => {
    const s = heuristicSignal({ ...base, text: "Selling my $MON, top is in" });
    expect(s.instrument).toBe("spot");
  });
  it("treats an asset with trade intent but no direction as a call", () => {
    const s = heuristicSignal({ ...base, text: "trade mon" });
    expect(s).toMatchObject({ isCall: true, asset: "MON", direction: null });
  });
  it("ignores ordinary posts", () => {
    expect(heuristicSignal({ ...base, text: "gm, coffee time" }).isCall).toBe(
      false,
    );
  });
});

describe("deriveTradeRoute", () => {
  it("routes bullish ETH spot to a Kuru WETH buy", () => {
    const r = deriveTradeRoute(
      heuristicSignal({ ...base, text: "buy $ETH" }),
      perpl,
    );
    expect(r).toMatchObject({
      status: "available",
      venue: "Kuru",
      side: "buy",
      marketId: "WETH",
    });
  });
  it("routes bullish MON spot to the native MON/USDC book", () => {
    const r = deriveTradeRoute(
      heuristicSignal({ ...base, text: "buy $MON" }),
      perpl,
    );
    expect(r).toMatchObject({
      status: "available",
      venue: "Kuru",
      side: "buy",
      marketId: "MON",
    });
  });
  it("routes bearish spot to a sale, never a short", () => {
    const r = deriveTradeRoute(
      heuristicSignal({ ...base, text: "sell $BTC now" }),
      perpl,
    );
    expect(r).toMatchObject({
      venue: "Kuru",
      side: "sell",
      instrument: "spot",
    });
  });
  it("routes an explicit perp to an open Perpl market", () => {
    const r = deriveTradeRoute(
      heuristicSignal({ ...base, text: "long $BTC 5x" }),
      perpl,
    );
    expect(r).toMatchObject({ venue: "Perpl", side: "long", marketId: "1" });
  });
  it("does not substitute venues for unavailable markets", () => {
    expect(
      deriveTradeRoute(
        heuristicSignal({ ...base, text: "long $ETH 5x" }),
        perpl,
      ).status,
    ).toBe("unavailable");
    expect(
      deriveTradeRoute(heuristicSignal({ ...base, text: "buy $SOL" }), perpl)
        .status,
    ).toBe("unavailable");
  });
});

describe("rules-mode phrasing", () => {
  it("reads common bearish exits", () => {
    expect(
      heuristicSignal({ ...base, text: "ETH looks weak here, I'm out" }),
    ).toMatchObject({
      isCall: true,
      asset: "ETH",
      direction: "bearish",
      instrument: "spot",
    });
  });
});
