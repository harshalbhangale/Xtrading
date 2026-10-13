import type { NansenCheck } from "@call-my-bluff/domain";
import { expect, it, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("CMB_APP_ORIGIN", "https://xtradingnow.xyz");
});

import { riskVerdict } from "./risk-line";

const base: NansenCheck = {
  mode: "live",
  verdict: "no-activity",
  wallet: null,
  chain: "ethereum",
  window: null,
  findings: [],
  note: "",
  observedAt: "2026-10-13T00:00:00.000Z",
  flags: [],
  sources: [
    {
      endpoint: "tgm/flow-intelligence",
      chain: "ethereum",
      status: "ok",
      note: null,
    },
  ],
};

it("calls a front-run or a caution flag risky, with the reason", () => {
  expect(
    riskVerdict({
      ...base,
      verdict: "contradiction",
      findings: [
        {
          kind: "front-run",
          summary: "x",
          transactionHash: null,
          observedAt: null,
        },
      ],
    }).tone,
  ).toBe("risky");
  const flagged = riskVerdict({
    ...base,
    flags: [
      {
        kind: "thin-liquidity",
        severity: "caution",
        summary: "DEX liquidity is about $9,000.",
      },
      {
        kind: "holder-concentration",
        severity: "caution",
        summary: "Top 10 hold 70%.",
      },
    ],
  });
  expect(flagged).toEqual({
    tone: "risky",
    text: "Risky: DEX liquidity is about $9,000 (+1 more)",
  });
});

it("never claims clean without live data", () => {
  expect(riskVerdict(null).tone).toBe("unknown");
  expect(riskVerdict({ ...base, mode: "demo" }).tone).toBe("unknown");
  expect(
    riskVerdict({
      ...base,
      sources: [{ endpoint: "x", chain: null, status: "failed", note: null }],
    }).tone,
  ).toBe("unknown");
  expect(riskVerdict(base)).toEqual({
    tone: "clean",
    text: "No red flags in Nansen data",
  });
});
