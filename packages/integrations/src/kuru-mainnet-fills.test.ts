import { describe, expect, it } from "vitest";
import { kuruMainnet, mainnetFillsFromLogs } from "./kuru";

// Trade log from the confirmed 13 Oct 2026 mainnet buy (tx 0x7b3a5f41…),
// which bought 39.8231850583 MON for 1 USDC.
const tradeLog = {
  address: "0x065c9d28e428a0db40191a54d33d5b7c71a9c394",
  topics: [
    "0xf16924fba1c18c108912fcacaac7450c98eb3f2d8c0a3cdf3df7066c08f21581",
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000076b37cd000000000000000000000000d0f8a6422ccdd812f29d8fb75cf5fcd41483badc0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000005936524af47000000000000000000000000000000000000000000000000000000036d68b2fc7e300000000000000000000000002cefd0e0547bb176f508380399a982fab676a9200000000000000000000000002cefd0e0547bb176f508380399a982fab676a920000000000000000000000000000000000000000000000000000005cb877ce57",
} as const;
const wallet = "0x02cefD0E0547bb176f508380399A982fAb676A92" as const;

describe("mainnetFillsFromLogs", () => {
  it("recovers the MON bought by the wallet from the real receipt", () => {
    const fills = mainnetFillsFromLogs({
      key: "MON",
      wallet,
      logs: [tradeLog],
    });
    expect(fills?.side).toBe("buy");
    expect(fills?.baseAmount).toBe(39_823_185_058_300_000_000n);
    // About 1 USDC at the fill price, in 6-decimal units.
    expect(fills?.quoteAmount).toBeGreaterThan(990_000n);
    expect(fills?.quoteAmount).toBeLessThanOrEqual(1_000_000n);
  });

  it("ignores fills for another wallet or another market", () => {
    expect(
      mainnetFillsFromLogs({
        key: "MON",
        wallet: "0x0000000000000000000000000000000000000001",
        logs: [tradeLog],
      }),
    ).toBeNull();
    expect(
      mainnetFillsFromLogs({
        key: "WETH",
        wallet,
        logs: [{ ...tradeLog, address: kuruMainnet.markets.MON.market }],
      }),
    ).toBeNull();
  });
});
