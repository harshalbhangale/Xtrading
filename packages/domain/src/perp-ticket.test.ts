import { expect, it } from "vitest";
import {
  changeBps,
  formatUsd,
  fromUnits,
  liquidationPrice,
  sizeFromUsd,
  spotEstimate,
  ticketQuote,
  toUnits,
} from "./perp-ticket";

it("parses and formats scaled units without floats", () => {
  expect(toUnits("1.25", 2)).toBe(125n);
  expect(toUnits("1.255", 2)).toBeNull();
  expect(toUnits("abc", 2)).toBeNull();
  expect(fromUnits(125n, 2)).toBe("1.25");
  expect(formatUsd(826941n, 1)).toBe("$82,694.1");
  expect(formatUsd(123456789n, 2)).toBe("$1,234,567.89");
  expect(formatUsd(2499n, 5)).toBe("$0.0250");
});

it("quotes notional, margin and taker fee", () => {
  // 100 MON (size decimals 0) at $0.02499 (price decimals 5), 2x, 0.0345% taker.
  const quote = ticketQuote({
    sizeUnits: 100n,
    sizeDecimals: 0,
    price: 2499n,
    priceDecimals: 5,
    leverage: 2,
    takerFeePpm: 345,
  });
  expect(quote.notional).toBe(249900n);
  expect(quote.margin).toBe(124950n);
  expect(quote.fee).toBe(86n);
});

it("converts USD to size and reports price change", () => {
  expect(sizeFromUsd(toUnits("10", 5) ?? 0n, 2499n, 0)).toBe(400n);
  expect(changeBps(2499n, 2653n)).toBe(-580);
  expect(changeBps(2499n, null)).toBeNull();
});

it("estimates liquidation like Perpl's docs", () => {
  // Docs: 5x with 5% maintenance (2000) is liquidated after a ~15% move (fees ignored here).
  expect(
    liquidationPrice({
      entry: 100_000n,
      side: "long",
      leverageHundredths: 500,
      maintenanceHundredths: 2000,
    }),
  ).toBe(85_000n);
  // BTC docs example: 10x, 4% maintenance (2500) → liquidated at a 6% drop.
  expect(
    liquidationPrice({
      entry: 100_000n,
      side: "long",
      leverageHundredths: 1000,
      maintenanceHundredths: 2500,
    }),
  ).toBe(94_000n);
  expect(
    liquidationPrice({
      entry: 100_000n,
      side: "short",
      leverageHundredths: 1000,
      maintenanceHundredths: 2500,
    }),
  ).toBe(106_000n);
  // Leverage beyond the maintenance level has no safe estimate.
  expect(
    liquidationPrice({
      entry: 100n,
      side: "long",
      leverageHundredths: 3000,
      maintenanceHundredths: 2500,
    }),
  ).toBeNull();
});

it("estimates a Kuru spot fill at the best price after the taker fee", () => {
  // Buy MON with 10 USDC at 0.025 USDC (precision 1e6 → 25000), 7 bps fee.
  const buy = spotEstimate({
    side: "buy",
    amount: 10_000_000n,
    price: 25_000n,
    pricePrecision: 1_000_000n,
    baseDecimals: 18,
    quoteDecimals: 6,
    takerFeePps: 7000n,
  });
  expect(buy?.output).toBe(399_720_000_000_000_000_000n);
  // Sell 1 WETH at 2511.39 USDC (precision 100).
  const sell = spotEstimate({
    side: "sell",
    amount: 10n ** 18n,
    price: 251_139n,
    pricePrecision: 100n,
    baseDecimals: 18,
    quoteDecimals: 6,
    takerFeePps: 0n,
  });
  expect(sell?.output).toBe(2_511_390_000n);
});
