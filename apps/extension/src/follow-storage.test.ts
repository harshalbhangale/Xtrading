import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFollowing, updateFollowing } from "./follow-storage";

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
it("does not store follow observations before opt-in", async () => {
  await updateFollowing("alice", {
    observations: [{ handle: "bob", following: true }],
  });
  expect((await readFollowing("alice")).follows).toEqual([]);
  expect(values).toEqual({});
});
it("isolates viewers, deduplicates follows, removes visible unfollows and clears on disable", async () => {
  await updateFollowing("alice", { enabled: true });
  await updateFollowing("alice", {
    observations: [
      { handle: "bob", following: true },
      { handle: "bob", following: true },
    ],
  });
  expect((await readFollowing("alice")).follows).toHaveLength(1);
  expect((await readFollowing("charlie")).follows).toEqual([]);
  await updateFollowing("alice", {
    observations: [{ handle: "bob", following: false }],
  });
  expect((await readFollowing("alice")).follows).toEqual([]);
  await updateFollowing("alice", {
    observations: [{ handle: "bob", following: true }],
  });
  await updateFollowing("alice", { enabled: false });
  expect((await readFollowing("alice")).follows).toEqual([]);
});
it("does not trust malformed stored data or invalid handles", async () => {
  values["tradepost.viewed-follows.v1:alice"] = {
    viewerHandle: "mallory",
    enabled: true,
  };
  expect((await readFollowing("alice")).enabled).toBe(false);
  await expect(readFollowing("../oops")).rejects.toThrow();
});
