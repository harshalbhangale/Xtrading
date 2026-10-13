import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readWatchlist, updateWatchlist } from "./watchlist-storage";

let values: Record<string, unknown>;
beforeEach(() => {
  values = {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: values[key] }),
        set: async (next: Record<string, unknown>) => {
          Object.assign(values, next);
        },
      },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("adds newest first, keeps one entry per handle and removes on request", async () => {
  await updateWatchlist({ action: "add", handle: "alice" });
  await updateWatchlist({ action: "add", handle: "bob" });
  const again = await updateWatchlist({ action: "add", handle: "alice" });
  expect(again).toEqual({ entries: expect.any(Array) });
  if (!("entries" in again)) throw new Error("expected entries");
  expect(again.entries.map((entry) => entry.handle)).toEqual(["bob", "alice"]);

  const removed = await updateWatchlist({ action: "remove", handle: "bob" });
  expect(removed).toEqual({ entries: expect.any(Array) });
  expect((await readWatchlist()).map((entry) => entry.handle)).toEqual([
    "alice",
  ]);
});

it("refuses a 51st handle without changing the stored list", async () => {
  for (let index = 0; index < 50; index += 1)
    await updateWatchlist({ action: "add", handle: `kol_${index}` });
  const before = JSON.stringify(values);
  expect(await updateWatchlist({ action: "add", handle: "one_more" })).toEqual({
    error: "watchlist_full",
  });
  expect(JSON.stringify(values)).toBe(before);
});

it("reads invalid stored data as an empty watchlist", async () => {
  values["tradepost.watchlist.v1"] = { entries: [{ handle: "@Bad Handle" }] };
  expect(await readWatchlist()).toEqual([]);
});
