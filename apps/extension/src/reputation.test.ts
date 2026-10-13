// @vitest-environment happy-dom
import type { KolReputation } from "@call-my-bluff/domain";
import { describe, expect, it } from "vitest";
import { flagChip, tierChip, tierLabel } from "./reputation";

const base = (
  overrides: Partial<KolReputation["assessment"]> = {},
): KolReputation => ({
  handle: "kol",
  bound: true,
  assessment: {
    scored: 6,
    hits: 4,
    open: 1,
    tier: "pro",
    feeBps: 50,
    progressBps: 4000,
    next: { name: "Xtrading Max" },
    flags: [],
    ...overrides,
  },
});

describe("reputation chips", () => {
  it("shows the tier and its per-buy cut", () => {
    expect(tierChip(base())?.textContent).toBe("PRO");
    expect(tierChip(base())?.title).toContain("0.5% of each buy");
    expect(tierLabel(base())).toBe(
      "Xtrading PRO · 0.5% per buy · 40% to Xtrading Max",
    );
  });
  it("shows nothing below Pro or when unavailable", () => {
    expect(tierChip(base({ tier: null, feeBps: 10 }))).toBeNull();
    expect(tierChip(null)).toBeNull();
    expect(tierLabel(base({ tier: null, feeBps: 10 }))).toContain(
      "No tier · 0.1% per buy",
    );
  });
  it("counts only serious red flags", () => {
    const flags = [
      {
        kind: "removed_post",
        severity: "serious" as const,
        title: "1 registered call no longer public",
        detail: "",
      },
      {
        kind: "mostly_wrong",
        severity: "warning" as const,
        title: "Mostly wrong",
        detail: "",
      },
    ];
    const chip = flagChip(base({ flags }));
    expect(chip?.textContent).toBe("⚑ 1");
    expect(chip?.title).toBe("1 registered call no longer public");
    expect(
      flagChip(base({ flags: [flags[1] as (typeof flags)[number]] })),
    ).toBeNull();
  });
});
