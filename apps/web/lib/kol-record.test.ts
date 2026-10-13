import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./calls", () => ({
  publicCallLedger: vi.fn().mockResolvedValue(null),
}));
vi.mock("./fill-indexing", () => ({ walletActivity: vi.fn() }));
vi.mock("./public-creator", () => ({
  publicCreatorEvidence: vi.fn().mockResolvedValue(null),
}));
vi.mock("./deletions", () => ({ deletionReport: vi.fn() }));

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
