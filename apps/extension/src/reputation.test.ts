// @vitest-environment happy-dom
import type { KolReputation } from "@call-my-bluff/domain";
import { describe, expect, it } from "vitest";
import {
  deletedTweetCount,
  deletedTweetsLabel,
  flagChip,
  tierChip,
  tierLabel,
} from "./reputation";

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
  it("counts missing tweets rather than serious flag categories", () => {
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
    const record = {
      ...base({ flags }),
      postAvailability: {
        indexed: 12,
        checked: 10,
        missing: 3,
        suspected: 1,
        observedAt: "2026-10-13T00:00:00.000Z",
      },
    };
    const chip = flagChip(record);
    expect(chip?.textContent).toBe("3 deleted / unavailable tweets");
    expect(chip?.title).toContain("out of 10 checked posts");
    expect(deletedTweetCount(record)).toBe(3);
    expect(deletedTweetsLabel(record)).toBe("3 · 1 missing once");
  });
  it("keeps absent and unchecked coverage unavailable, distinct from a checked zero", () => {
    expect(flagChip(base())).toBeNull();
    expect(deletedTweetCount(base())).toBeNull();
    expect(deletedTweetsLabel(null)).toContain("Unavailable");
    const unchecked = {
      ...base(),
      postAvailability: {
        indexed: 12,
        checked: 0,
        missing: 0,
        suspected: 0,
        observedAt: "2026-10-13T00:00:00.000Z",
      },
    };
    expect(deletedTweetCount(unchecked)).toBeNull();
    const checked = {
      ...unchecked,
      postAvailability: { ...unchecked.postAvailability, checked: 12 },
    };
    expect(deletedTweetsLabel(checked)).toBe("0");
    expect(flagChip(checked)).toBeNull();
  });
});
