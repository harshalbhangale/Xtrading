import { describe, expect, it } from "vitest";
import { matchTokenRiskReports, tokenRiskReports } from "./token-risk-reports";

const address = "0x9Cf8b570fAc7d129c2afA7058210D9137f55C081";
const input = { handle: "alice", postId: "123" };

describe("published token-risk matching", () => {
  it("matches the exact reported address case-insensitively with an explicit network", () => {
    const matches = matchTokenRiskReports({
      ...input,
      text: `PEPE CA: ${address} on BSC`,
    });
    expect(matches).toHaveLength(1);
    expect(matches[0]?.report.publisher).toBe("BNB Chain / DappBay");
    expect(matches[0]?.networkConfirmedByText).toBe(true);
  });

  it("does not flag legitimate PEPE, a ticker alone, or a different address", () => {
    for (const text of [
      "buy $PEPE",
      "PEPE CA: 0x6982508145454ce325ddbe47a25d4ec3d2311933 on Ethereum",
      `CA: ${address.slice(0, -1)}2 on BSC`,
    ])
      expect(matchTokenRiskReports({ ...input, text })).toEqual([]);
  });

  it("does not carry a BNB report across to another explicitly named chain", () => {
    for (const network of ["Ethereum", "Base", "Monad", "Solana"])
      expect(
        matchTokenRiskReports({
          ...input,
          text: `CA: ${address} on ${network}`,
        }),
      ).toEqual([]);
  });

  it("keeps unknown or conflicting networks explicitly unverified", () => {
    for (const text of [`CA: ${address}`, `CA: ${address} Ethereum and BSC`])
      expect(
        matchTokenRiskReports({ ...input, text })[0]?.networkConfirmedByText,
      ).toBe(false);
  });

  it("shows a published report only on the original reporting post with reporting text", () => {
    const report = {
      handle: "PeckShieldAlert",
      postId: "1622436301055336450",
      text: "Damus appears to be a honeypot; high selling tax",
    };
    const matches = matchTokenRiskReports(report);
    expect(matches).toHaveLength(2);
    expect(matches.every((m) => m.basis === "published-report")).toBe(true);
    expect(matchTokenRiskReports({ ...report, handle: "alice" })).toEqual([]);
    expect(matchTokenRiskReports({ ...report, postId: "123" })).toEqual([]);
    expect(
      matchTokenRiskReports({ ...report, text: "unrelated text" }),
    ).toEqual([]);
  });

  it("ships complete addresses, dates and HTTPS evidence, never Nansen-attributed fixtures", () => {
    for (const report of tokenRiskReports) {
      expect(report.address).toMatch(/^0x[0-9a-f]{40}$/);
      expect(report.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new URL(report.evidenceUrl).protocol).toBe("https:");
      expect(report.publisher).not.toBe("Nansen");
    }
  });
});
