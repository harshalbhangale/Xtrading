import { describe, expect, it } from "vitest";
import {
  amountSchema,
  hasActiveStake,
  indexedStakeSchema,
  normalizeHandle,
  tradeIntentSchema,
} from "./index";

describe("stake badge eligibility", () => {
  it("removes eligibility immediately when withdrawal is pending", () => {
    expect(hasActiveStake(500_000_000n, 500_000_000n, false)).toBe(true);
    expect(hasActiveStake(500_000_000n, 500_000_000n, true)).toBe(false);
    expect(hasActiveStake(499_999_999n, 500_000_000n, false)).toBe(false);
    expect(hasActiveStake(0n, 0n, false)).toBe(false);
  });
});

describe("external input", () => {
  it("rejects imprecise indexed amounts and invalid event dates", () => {
    const event = {
      id: "10143:70172401:5",
      balance: "9007199254740993000000",
      withdrawableAt: "0",
      blockNumber: "70172401",
      timestamp: "1791740130",
    };
    const evidence = {
      status: "current",
      observedAt: "2026-10-11T17:35:00Z",
      events: [event],
    };
    expect(indexedStakeSchema.parse(evidence).events[0]?.balance).toBe(
      event.balance,
    );
    for (const change of [
      { balance: 500000000 },
      { balance: "1e9" },
      { timestamp: "253402300800" },
      { withdrawableAt: "99999999999999999999" },
      { id: "1:70172401:5" },
    ]) {
      expect(
        indexedStakeSchema.safeParse({
          ...evidence,
          events: [{ ...event, ...change }],
        }).success,
      ).toBe(false);
    }
  });
  it("keeps raw token amounts precise and rejects float notation", () => {
    expect(amountSchema.parse("9007199254740993000000")).toBe(
      "9007199254740993000000",
    );
    for (const value of ["1.5", "1e9", "-1", "01"])
      expect(amountSchema.safeParse(value).success).toBe(false);
  });
  it("restricts creator handles", () => {
    expect(normalizeHandle("@Alice_KOL")).toBe("alice_kol");
    expect(normalizeHandle("../../api")).toBeNull();
  });
  it("rejects zero-value trades and unsupported chains", () => {
    const intent = {
      chainId: 10143,
      market: "0x1111111111111111111111111111111111111111",
      side: "buy",
      amount: "1",
      source: { postId: "123", creatorXUserId: "456" },
    };
    expect(tradeIntentSchema.safeParse(intent).success).toBe(true);
    expect(
      tradeIntentSchema.safeParse({ ...intent, amount: "0" }).success,
    ).toBe(false);
    expect(tradeIntentSchema.safeParse({ ...intent, chainId: 1 }).success).toBe(
      false,
    );
  });
});
