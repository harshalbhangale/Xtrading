import { describe, expect, it } from "vitest";
import { watchlistCommandSchema, watchlistSchema } from "./watchlist";

describe("watchlistCommandSchema", () => {
  it("accepts reads without a handle and writes with a normalized handle", () => {
    expect(watchlistCommandSchema.safeParse({ action: "read" }).success).toBe(
      true,
    );
    expect(
      watchlistCommandSchema.safeParse({ action: "add", handle: "apx_gmso2i" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown actions, unnormalized handles and missing handles", () => {
    expect(watchlistCommandSchema.safeParse({ action: "buy" }).success).toBe(
      false,
    );
    expect(
      watchlistCommandSchema.safeParse({ action: "add", handle: "@Apx" })
        .success,
    ).toBe(false);
    expect(watchlistCommandSchema.safeParse({ action: "remove" }).success).toBe(
      false,
    );
  });
});

describe("watchlistSchema", () => {
  it("caps the saved list at 50 entries", () => {
    const entry = { handle: "alice", savedAt: "2026-10-13T10:00:00.000Z" };
    expect(watchlistSchema.safeParse({ entries: [entry] }).success).toBe(true);
    expect(
      watchlistSchema.safeParse({
        entries: Array.from({ length: 51 }, () => entry),
      }).success,
    ).toBe(false);
  });
});
