import { describe, expect, it } from "vitest";
import {
  buildPerplCloseOrder,
  type CloseReview,
  signCloseReview,
  verifyCloseReview,
} from "./perpl-close";

const now = 100000;
const r: CloseReview = {
  accountId: 1096,
  positionId: "123",
  marketId: 32,
  side: "long",
  size: "1",
  leverageHundredths: 300,
  slippageBps: 50,
  requestId: 123,
  expiresAt: now + 60000,
  owner: "operator",
};
describe("Perpl reviewed close", () => {
  it("uses close-only types for both sides, never opposing opens", () => {
    expect(buildPerplCloseOrder(r)).toMatchObject({
      t: 3,
      s: 1,
      fl: 4,
      acc: 1096,
    });
    expect(buildPerplCloseOrder({ ...r, side: "short" })).toMatchObject({
      t: 4,
    });
  });
  it("rejects unsafe amounts, zero size and excess slippage", () => {
    for (const value of [
      { ...r, size: "9007199254740992" },
      { ...r, size: "0" },
      { ...r, slippageBps: 501 },
    ])
      expect(() => buildPerplCloseOrder(value)).toThrow();
  });
  it("binds review to operator and expiry", () => {
    const token = signCloseReview(r, "secret");
    expect(verifyCloseReview(token, "secret", "operator", now)).toEqual(r);
    expect(() => verifyCloseReview(token, "secret", "other", now)).toThrow();
    expect(() =>
      verifyCloseReview(token, "secret", "operator", r.expiresAt),
    ).toThrow();
  });
  it("rejects tampering and wrong signing key", () => {
    const token = signCloseReview(r, "secret");
    expect(() =>
      verifyCloseReview(`${token}x`, "secret", "operator", now),
    ).toThrow();
    expect(() =>
      verifyCloseReview(token, "different", "operator", now),
    ).toThrow();
    const changed = Buffer.from(
      JSON.stringify({ ...r, size: "1000" }),
    ).toString("base64url");
    expect(() =>
      verifyCloseReview(
        `${changed}.${token.split(".")[1]}`,
        "secret",
        "operator",
        now,
      ),
    ).toThrow();
  });
});
