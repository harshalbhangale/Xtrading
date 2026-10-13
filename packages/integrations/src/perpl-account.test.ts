import { describe, expect, it } from "vitest";
import { projectPerplAccount } from "./perpl-account";

const wallet = {
  addr: `0x${"11".repeat(20)}`,
  as: [{ id: 1096, fw: true, fr: false, b: "99145768", lfr: 123 }],
};
const position = {
  acc: 1096,
  mkt: 32,
  pid: 123,
  st: 1,
  sd: 1,
  c: "840907",
  ep: 252272,
  s: 1,
  lv: 300,
  rq: 0,
};
const fill = {
  acc: 1096,
  mkt: 32,
  rq: 100,
  st: 4,
  fs: 1,
  fp: 252272,
  f: "871",
  at: { txid: "22".repeat(32), b: 100 },
};
describe("Perpl account projections", () => {
  it("shows positions even when Perpl returns request ID zero", () => {
    const r = projectPerplAccount(
      "1096",
      wallet,
      { d: [position] },
      { d: [fill] },
    );
    expect(r.positions[0]).toMatchObject({
      side: "long",
      size: "1",
      collateral: "840907",
    });
    expect(r.availableCollateral).toBe("99145768");
    expect(r.fills[0]?.transactionHash).toBe(`0x${"22".repeat(32)}`);
  });
  it("excludes other accounts and closed positions", () => {
    const r = projectPerplAccount(
      "1096",
      wallet,
      {
        d: [
          { ...position, acc: 100 },
          { ...position, st: 2 },
        ],
      },
      { d: [{ ...fill, acc: 100 }] },
    );
    expect(r.positions).toEqual([]);
    expect(r.fills).toEqual([]);
  });
  it("rejects an account not owned by the API wallet", () => {
    expect(() =>
      projectPerplAccount("500", wallet, { d: [] }, { d: [] }),
    ).toThrow("account_not_owned");
  });
  it("rejects unsafe numeric sizes and preserves large collateral strings", () => {
    expect(() =>
      projectPerplAccount(
        "1096",
        wallet,
        { d: [{ ...position, s: Number.MAX_SAFE_INTEGER + 1 }] },
        { d: [] },
      ),
    ).toThrow();
    expect(
      projectPerplAccount(
        "1096",
        { ...wallet, as: [{ ...wallet.as[0], b: "900719925474099300000" }] },
        { d: [] },
        { d: [] },
      ).availableCollateral,
    ).toBe("900719925474099300000");
  });
});
