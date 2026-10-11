import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/web/node_modules/server-only/index.js", () => ({}));
const fixture = vi.hoisted(() => ({
  available: true,
  rows: [] as Array<{
    xUserId: string;
    wallet: string;
    linkedAt: Date;
    privyUserId?: string;
  }>,
}));
vi.mock("../../../apps/web/lib/database", () => ({
  getDatabase: () =>
    fixture.available
      ? {
          db: {
            select: () => ({
              from: () => ({
                where: () => ({ limit: async () => fixture.rows }),
              }),
            }),
          },
        }
      : undefined,
}));

import { publicCreatorEvidence } from "../../../apps/web/lib/public-creator";

afterEach(() => {
  fixture.rows = [];
  fixture.available = true;
  vi.unstubAllEnvs();
});
describe("public creator evidence", () => {
  it("rejects path inputs and shows unavailable for missing records", async () => {
    expect(await publicCreatorEvidence("../../api")).toBeNull();
    expect((await publicCreatorEvidence("Alice"))?.identity.status).toBe(
      "unavailable",
    );
    fixture.available = false;
    expect((await publicCreatorEvidence("Alice"))?.stake.status).toBe(
      "unavailable",
    );
  });
  it("does not select between ambiguous handle bindings", async () => {
    const row = {
      xUserId: "123",
      wallet: "0x1111111111111111111111111111111111111111",
      linkedAt: new Date("2026-10-11T00:00:00Z"),
    };
    fixture.rows = [row, { ...row, xUserId: "456" }];
    expect((await publicCreatorEvidence("alice"))?.identity.status).toBe(
      "unavailable",
    );
  });
  it("exposes stable binding evidence without private session IDs or fabricated stake", async () => {
    vi.stubEnv("CREATOR_STAKE_ADDRESS", "");
    fixture.rows = [
      {
        xUserId: "123",
        wallet: "0x1111111111111111111111111111111111111111",
        linkedAt: new Date("2026-10-11T00:00:00Z"),
        privyUserId: "private-session",
      },
    ];
    const result = await publicCreatorEvidence("ALICE");
    expect(result?.identity.xUserId).toBe("123");
    expect(result?.stake.status).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("private-session");
  });
});
