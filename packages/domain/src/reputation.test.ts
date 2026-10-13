import { describe, expect, it } from "vitest";
import type { PublicCall } from "./index";
import { assessKol, kolFlags, profitShare } from "./reputation";

const published = "2026-10-01T00:00:00.000Z";
const start = Date.parse(published) / 1000;
let seq = 0;
function call(
  overrides: {
    outcome?: "success" | "failure" | "tie" | null;
    returnBps?: string | null;
    horizon?: "24h" | "7d" | "30d";
    asset?: "BTC" | "ETH" | "SOL" | "MON";
    direction?: "up" | "down";
    availability?: {
      status: "available" | "not-publicly-available" | "unavailable";
      checkedAt: string;
    }[];
    bond?: PublicCall["bond"];
  } = {},
): PublicCall {
  seq += 1;
  const outcome =
    overrides.outcome === undefined ? "success" : overrides.outcome;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    postId: String(1_000 + seq),
    sourceUrl: `https://x.com/kol/status/${1_000 + seq}`,
    publishedAt: published,
    registeredAt: published,
    status: outcome ? "resolved" : "open",
    bond: overrides.bond,
    evidence: {
      post: { authorHandle: "kol", text: "", verifiedAt: published },
      horizon: overrides.horizon ?? "24h",
      terms: {
        methodology: "directional-return-v1",
        assetId: overrides.asset ?? "ETH",
        sourceId: "binance-spot-1m-open:ETHUSDT",
        direction: overrides.direction ?? "up",
        entryPrice: "200000000000",
        priceDecimals: 8,
        expiry: String(start + 86400),
        toleranceSeconds: "600",
        targetBps: "1",
      },
      entry: {
        assetId: "ETH",
        sourceId: "binance-spot-1m-open:ETHUSDT",
        price: "200000000000",
        priceDecimals: 8,
        timestamp: String(start),
      },
      exit: null,
      outcome,
      returnBps:
        overrides.returnBps === undefined
          ? outcome === "failure"
            ? "-150"
            : outcome
              ? "200"
              : null
          : overrides.returnBps,
      lastAttemptAt: null,
      availability: overrides.availability,
    },
  };
}
const many = (n: number, outcome: "success" | "failure", extra = {}) =>
  Array.from({ length: n }, () => call({ outcome, ...extra }));

describe("assessKol", () => {
  it("earns no tier and no fee share below the Pro bar, with progress", () => {
    const result = assessKol({ calls: many(3, "success"), swaps: [] });
    expect(result.tier).toBeNull();
    expect(result.profitShareBps).toBe(0);
    expect(result.next?.id).toBe("pro");
    // 3/5 scored (60%) and 100% right (capped) → 80%.
    expect(result.progressBps).toBe(8000);
  });

  it("reaches Pro, Max and Ultra by sample size, hit rate and median", () => {
    const pro = assessKol({
      calls: [...many(3, "success"), ...many(2, "failure")],
      swaps: [],
    });
    expect(pro.tier).toBe("pro");
    expect(pro.profitShareBps).toBe(500);

    const max = assessKol({
      calls: [...many(10, "success"), ...many(5, "failure")],
      swaps: [],
    });
    expect(max.tier).toBe("max");
    expect(max.profitShareBps).toBe(1000);

    const ultra = assessKol({
      calls: [
        ...many(20, "success", { horizon: "7d" }),
        ...many(10, "failure"),
      ],
      swaps: [],
    });
    expect(ultra.tier).toBe("ultra");
    expect(ultra.profitShareBps).toBe(1500);
    expect(ultra.next).toBeNull();
  });

  it("demotes one tier per distinct serious flag", () => {
    const gone = call({
      outcome: "failure",
      availability: [
        { status: "not-publicly-available", checkedAt: published },
        { status: "not-publicly-available", checkedAt: published },
      ],
    });
    const result = assessKol({
      calls: [...many(11, "success"), ...many(3, "failure"), gone],
      swaps: [],
    });
    expect(result.earnedTier).toBe("max");
    expect(result.tier).toBe("pro");
    expect(result.flags[0]?.kind).toBe("removed_post");
    expect(result.flags[0]?.detail).toContain("1 had resolved wrong");
  });
});

describe("kolFlags", () => {
  it("needs two consecutive misses before calling a post removed", () => {
    const once = call({
      availability: [
        { status: "available", checkedAt: published },
        { status: "not-publicly-available", checkedAt: published },
      ],
    });
    const outage = call({
      availability: [
        { status: "not-publicly-available", checkedAt: published },
        { status: "unavailable", checkedAt: published },
      ],
    });
    expect(
      kolFlags({ calls: [once, outage], swaps: [], hitBps: null, scored: 0 }),
    ).toEqual([]);
  });

  it("flags swaps against an open call on the same asset only", () => {
    const up = call({ outcome: null, asset: "ETH", direction: "up" });
    const flags = kolFlags({
      calls: [up],
      swaps: [
        {
          market: "WETH",
          side: "sell",
          timestamp: String(start + 60),
          transactionHash: "0xaa",
        },
        // Same direction, other asset, or outside the window: not flagged.
        {
          market: "WETH",
          side: "buy",
          timestamp: String(start + 60),
          transactionHash: "0xbb",
        },
        {
          market: "MON",
          side: "sell",
          timestamp: String(start + 60),
          transactionHash: "0xcc",
        },
        {
          market: "WETH",
          side: "sell",
          timestamp: String(start - 60),
          transactionHash: "0xdd",
        },
      ],
      hitBps: null,
      scored: 0,
    });
    expect(flags).toHaveLength(1);
    expect(flags[0]?.transactions).toEqual(["0xaa"]);
  });

  it("warns on mostly-wrong records and slashed bonds", () => {
    const kinds = kolFlags({
      calls: [
        call({
          outcome: "failure",
          bond: {
            contract: "0x260264E74028d498a1A10f90dDC4f4b91F3395DF",
            status: "failure",
            bond: "1",
            reward: "1",
            start: "1",
            expiry: "2",
            entryPrice: "1",
            exitPrice: "1",
            payout: "0",
            registeredTx: `0x${"1".repeat(64)}`,
            settledTx: `0x${"2".repeat(64)}`,
          },
        }),
      ],
      swaps: [],
      hitBps: 2000,
      scored: 5,
    }).map((f) => f.kind);
    expect(kinds).toEqual(["mostly_wrong", "slashed_bond"]);
  });
});

describe("profitShare", () => {
  it("takes the tier share of realized profit only", () => {
    expect(
      profitShare({
        proceeds: 1_200_000n,
        costBasis: 1_000_000n,
        shareBps: 500,
      }),
    ).toBe(10_000n);
    expect(
      profitShare({
        proceeds: 900_000n,
        costBasis: 1_000_000n,
        shareBps: 1500,
      }),
    ).toBe(0n);
    expect(
      profitShare({ proceeds: 1_200_000n, costBasis: 1_000_000n, shareBps: 0 }),
    ).toBe(0n);
  });
});
