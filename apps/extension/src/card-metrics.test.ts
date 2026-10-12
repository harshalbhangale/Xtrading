import type { PublicCall } from "@call-my-bluff/domain";
import { expect, it } from "vitest";
import {
  byAssetDirection,
  callStats,
  callsLine,
  formatBps,
  formatUnits6,
  profitFactor,
  worstCall,
} from "./card-metrics";

const call = (
  horizon: "24h" | "7d",
  outcome: "success" | "failure" | null,
  returnBps: string | null,
  status: "open" | "resolved" = "resolved",
  asset = "ETH",
  direction: "up" | "down" = "up",
) =>
  ({
    status,
    evidence: {
      horizon,
      outcome,
      returnBps,
      terms: { assetId: asset, direction },
    },
  }) as unknown as PublicCall;

it("summarises hit rate and median return per horizon", () => {
  const stats = callStats([
    call("24h", "success", "400"),
    call("24h", "success", "200"),
    call("24h", "failure", "-100"),
    call("7d", "failure", "-120"),
    call("7d", null, null, "open"),
  ]);
  expect(stats).toEqual({
    scored: 4,
    hits: 2,
    open: 1,
    medianBps: { "24h": 200, "7d": -120 },
  });
  expect(callsLine(stats, 0)).toBe("2/4 right · +2.0% at 24h · −1.2% at 7d");
});

it("is honest when nothing is scored", () => {
  expect(callStats([])).toBeNull();
  expect(callsLine(null, 0)).toBeNull();
  expect(callsLine(null, 3)).toBe("3 posts detected · none scored yet");
  expect(callsLine(callStats([call("24h", null, null, "open")]), 0)).toBe(
    "No scored calls yet · 1 open",
  );
});

it("formats basis points and six-decimal amounts without floats for amounts", () => {
  expect(formatBps(-120)).toBe("−1.2%");
  expect(formatUnits6("500000000")).toBe("500");
  expect(formatUnits6("1250000")).toBe("1.25");
});

it("finds the worst call, profit factor and per-asset results", () => {
  const calls = [
    call("24h", "success", "300"),
    call("24h", "failure", "-200", "resolved", "BTC", "down"),
    call("7d", "success", "100"),
    call("7d", null, null, "open"),
  ];
  expect(worstCall(calls)?.evidence.returnBps).toBe("-200");
  expect(profitFactor(calls)).toBe(2);
  expect(profitFactor([call("24h", "success", "100")])).toBeNull();
  expect(byAssetDirection(calls)).toEqual([
    { asset: "ETH", direction: "up", scored: 2, hits: 2, medianBps: 200 },
    { asset: "BTC", direction: "down", scored: 1, hits: 0, medianBps: -200 },
  ]);
});
