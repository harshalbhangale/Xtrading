import { describe, expect, it } from "vitest";
import { mainnetTradesSchema, recordTradeSchema } from "./index";

const hash = `0x${"ab".repeat(32)}`;

describe("recordTradeSchema", () => {
  it("requires a supported chain alongside the transaction and post", () => {
    expect(
      recordTradeSchema.safeParse({
        transactionHash: hash,
        sourcePostId: "123",
        chainId: 143,
      }).success,
    ).toBe(true);
    expect(
      recordTradeSchema.safeParse({
        transactionHash: hash,
        sourcePostId: "123",
        chainId: 10143,
      }).success,
    ).toBe(true);
    expect(
      recordTradeSchema.safeParse({
        transactionHash: hash,
        sourcePostId: "123",
      }).success,
    ).toBe(false);
    expect(
      recordTradeSchema.safeParse({
        transactionHash: hash,
        sourcePostId: "123",
        chainId: 1,
      }).success,
    ).toBe(false);
  });
});

describe("mainnetTradesSchema", () => {
  it("accepts an honest unavailable state with a reason and no trades", () => {
    expect(
      mainnetTradesSchema.safeParse({
        status: "unavailable",
        observedAt: "2026-10-13T10:00:00.000Z",
        reason: "mainnet_trading_disabled",
        trades: [],
      }).success,
    ).toBe(true);
  });

  it("rejects amounts that are not plain integers", () => {
    const row = {
      transactionHash: hash,
      sourcePostId: "123",
      recordedAt: "2026-10-13T10:00:00.000Z",
      verified: true,
      market: "MON",
      side: "buy",
      inputAmount: "1.5",
      minAmountOut: "1",
      blockNumber: "10",
    };
    expect(
      mainnetTradesSchema.safeParse({
        status: "ready",
        observedAt: "2026-10-13T10:00:00.000Z",
        trades: [row],
      }).success,
    ).toBe(false);
  });
});
