import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./calls", () => ({
  publicCallLedger: vi.fn().mockResolvedValue(null),
}));
vi.mock("./fill-indexing", () => ({ walletActivity: vi.fn() }));
vi.mock("./public-creator", () => ({
  publicCreatorEvidence: vi.fn().mockResolvedValue(null),
}));
vi.mock("@call-my-bluff/domain", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@call-my-bluff/domain")>();
  // Scoring is covered in the domain package; these tests are about coverage counts.
  return {
    ...actual,
    assessKol: (input: Parameters<typeof actual.assessKol>[0]) =>
      actual.assessKol({ ...input, calls: [] }),
  };
});
vi.mock("./deletions", async (importOriginal) => ({
  mergeCallAvailability: (await importOriginal<typeof import("./deletions")>())
    .mergeCallAvailability,
  deletionReport: vi.fn(),
}));

import type { PublicCall } from "@call-my-bluff/domain";
import { publicCallLedger } from "./calls";
import { deletionReport } from "./deletions";
import { kolRecord } from "./kol-record";

beforeEach(() => vi.clearAllMocks());

it("returns the persisted captured-post count independently of registered-call flags", async () => {
  vi.mocked(deletionReport).mockResolvedValue({
    since: "1970-01-01T00:00:00.000Z",
    observedAt: "2026-10-13T00:00:00.000Z",
    totals: { indexed: 12, checked: 10, removed: 3, suspected: 1 },
    creators: [],
    note: "",
    indexedPostIds: [],
  });
  const record = await kolRecord("Alice");
  expect(record?.postAvailability).toEqual({
    indexed: 12,
    checked: 10,
    missing: 3,
    suspected: 1,
    observedAt: "2026-10-13T00:00:00.000Z",
  });
  expect(record?.assessment.flags).toEqual([]);
  expect(deletionReport).toHaveBeenCalledWith({
    handle: "alice",
    since: new Date(0),
    sweep: false,
  });
});

it("does not turn a failed availability lookup into zero deleted tweets", async () => {
  vi.mocked(deletionReport).mockRejectedValue(
    new Error("database unavailable"),
  );
  expect((await kolRecord("alice"))?.postAvailability).toBeNull();
});

it("counts a deleted registered call even when it was never captured as a signal", async () => {
  vi.mocked(deletionReport).mockResolvedValue({
    since: "1970-01-01T00:00:00.000Z",
    observedAt: "2026-10-13T00:00:00.000Z",
    totals: { indexed: 1, checked: 1, removed: 0, suspected: 0 },
    creators: [],
    note: "",
    indexedPostIds: ["1"],
  });
  const gone = {
    status: "not-publicly-available",
    checkedAt: "2026-10-13T00:00:00.000Z",
  };
  const call = (postId: string, availability: (typeof gone)[]) =>
    ({ postId, evidence: { availability } }) as unknown as PublicCall;
  vi.mocked(publicCallLedger).mockResolvedValueOnce({
    calls: [
      call("1", [gone, gone]),
      call("2", [gone, gone]),
      call("3", [gone]),
    ],
  } as never);
  const record = await kolRecord("alice");
  expect(record?.postAvailability).toMatchObject({
    indexed: 3,
    checked: 3,
    missing: 1,
    suspected: 1,
  });
});
