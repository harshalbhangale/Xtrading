import { describe, expect, it } from "vitest";
import {
  addressFlags,
  assessWalletTiming,
  MAJOR_TARGETS,
  type PositionEvent,
  perpEvents,
  sellersAfterCall,
  spotEvents,
  tokenFlags,
  topHoldersPct,
  walletWindow,
} from "./nansen-evidence";

const callAt = Date.parse("2026-10-05T12:00:00Z");
const event = (
  action: PositionEvent["action"],
  at: string,
  valueUsd: number | null = 1000,
): PositionEvent => ({
  venue: action === "buy" || action === "sell" ? "spot" : "perp",
  chain: "base",
  action,
  valueUsd,
  at,
  transactionHash: `0x${"a".repeat(64)}`,
});

describe("walletWindow", () => {
  it("centres on the post and never reaches into the future", () => {
    const now = callAt + 2 * 86_400_000;
    expect(walletWindow(callAt, now)).toEqual({
      from: "2026-09-28T12:00:00.000Z",
      to: "2026-10-07T12:00:00.000Z",
    });
  });
  it("falls back to the last 30 days without a post time", () => {
    const now = callAt;
    expect(walletWindow(null, now).from).toBe("2026-09-05T12:00:00.000Z");
  });
});

describe("spotEvents", () => {
  const weth = MAJOR_TARGETS.ETH?.[1]?.addresses ?? [];
  const row = (bought: string, sold: string) => ({
    block_timestamp: "2026-10-05T13:00:00Z",
    transaction_hash: "0x1",
    token_bought_address: bought,
    token_sold_address: sold,
    trade_value_usd: 50,
  });
  it("matches by contract address, not by symbol", () => {
    const fake = { ...row("0xfake", "0xusdc"), token_bought_symbol: "WETH" };
    expect(spotEvents([fake], weth, "base")).toEqual([]);
    expect(
      spotEvents([row(weth[0] as string, "0xusdc")], weth, "base")[0]?.action,
    ).toBe("buy");
  });
  it("ignores wrapping between two forms of the same asset", () => {
    expect(
      spotEvents(
        [row(weth[0] as string, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")],
        weth,
        "base",
      ),
    ).toEqual([]);
  });
});

describe("perpEvents", () => {
  it("maps Hyperliquid opens and closes, skipping liquidations and other assets", () => {
    const base = {
      timestamp: "2026-10-05T13:00:00Z",
      token_symbol: "BTC",
      value_usd: 10,
      transaction_hash: "0x2",
    };
    const events = perpEvents(
      [
        { ...base, side: "Long", action: "Open" },
        { ...base, side: "Short", action: "Close" },
        { ...base, side: "Long", action: "Liquidation" },
        { ...base, side: "Long", action: "Open", token_symbol: "ETH" },
      ],
      "BTC",
    );
    expect(events.map((e) => e.action)).toEqual(["open-long", "close-short"]);
  });
});

describe("assessWalletTiming", () => {
  it("flags buying before a bullish post and selling after as front-running", () => {
    const result = assessWalletTiming({
      asset: "PEPE",
      direction: "bullish",
      callAt,
      events: [
        event("buy", "2026-10-04T12:00:00Z", 2000),
        event("sell", "2026-10-06T12:00:00Z", 2500),
      ],
    });
    expect(result.verdict).toBe("contradiction");
    expect(result.findings[0]?.kind).toBe("front-run");
    expect(result.findings[1]?.summary).toContain("after the post");
  });
  it("treats a perp short opened after a bullish post as against the call", () => {
    const result = assessWalletTiming({
      asset: "BTC",
      direction: "bullish",
      callAt,
      events: [event("open-short", "2026-10-05T14:00:00Z")],
    });
    expect(result.verdict).toBe("contradiction");
    expect(result.findings[0]?.kind).toBe("perp-short");
  });
  it("marks aligned activity after a bearish post consistent", () => {
    expect(
      assessWalletTiming({
        asset: "ETH",
        direction: "bearish",
        callAt,
        events: [event("sell", "2026-10-05T13:00:00Z")],
      }).verdict,
    ).toBe("consistent");
  });
  it("does not call a small trim after a large pre-post buy a front-run", () => {
    const result = assessWalletTiming({
      asset: "MON",
      direction: "bullish",
      callAt,
      events: [
        event("buy", "2026-10-04T12:00:00Z", 10_000),
        event("sell", "2026-10-06T12:00:00Z", 100),
        event("buy", "2026-10-06T13:00:00Z", 500),
      ],
    });
    expect(result.verdict).toBe("consistent");
    expect(result.findings.some((f) => f.kind === "front-run")).toBe(false);
  });
  it("reports no activity when nothing matched", () => {
    expect(
      assessWalletTiming({
        asset: "MON",
        direction: "bullish",
        callAt,
        events: [],
      }).verdict,
    ).toBe("no-activity");
  });
  it("without a post time, compares net activity over the window", () => {
    expect(
      assessWalletTiming({
        asset: "MON",
        direction: "bullish",
        callAt: null,
        events: [
          event("sell", "2026-10-04T12:00:00Z", 500),
          event("buy", "2026-10-06T12:00:00Z", 100),
        ],
      }).verdict,
    ).toBe("contradiction");
  });
});

describe("token evidence", () => {
  it("computes top-10 share from supply, excluding pools, exchanges and burns", () => {
    const rows = [
      {
        address: "0xpool",
        address_label: "Uniswap V3 Pool",
        token_amount: 500,
      },
      {
        address: "0xcex",
        address_label: "Binance Exchange",
        token_amount: 200,
      },
      {
        address: "0x000000000000000000000000000000000000dead",
        address_label: null,
        token_amount: 100,
      },
      { address: "0xa", address_label: null, token_amount: 60 },
      { address: "0xb", address_label: "Whale", token_amount: 40 },
    ];
    expect(topHoldersPct(rows, 1000)).toBe(10);
    // Without a known supply there is no figure rather than a guess.
    expect(topHoldersPct(rows, null)).toBeNull();
  });
  it("marks the creator and linked wallets among net sellers", () => {
    const sellers = sellersAfterCall(
      [
        { address: "0xME", sold_volume_usd: 900, bought_volume_usd: 0 },
        { address: "0xfriend", sold_volume_usd: 500, bought_volume_usd: 10 },
        { address: "0xbuyer", sold_volume_usd: 1, bought_volume_usd: 50 },
      ],
      "0xme",
      new Set(["0xfriend"]),
    );
    expect(sellers.map((s) => [s.isCreator, s.isLinked])).toEqual([
      [true, false],
      [false, true],
    ]);
  });
  it("raises cautions only from data that was returned", () => {
    const token = {
      symbol: "PEPE",
      origin: "post" as const,
      liquidityUsd: 12_000,
      deployedAt: "2026-10-01T00:00:00Z",
      topHoldersPct: 62,
      flows: {
        timeframe: "1d",
        smartTraderNetUsd: -40_000,
        whaleNetUsd: null,
        publicFigureNetUsd: null,
        freshWalletsNetUsd: 80_000,
        exchangeNetUsd: null,
      },
      sellersAfterCall: [
        {
          address: "0xme",
          label: null,
          soldUsd: 900,
          boughtUsd: 0,
          isCreator: true,
          isLinked: false,
        },
      ],
    };
    const kinds = tokenFlags({
      direction: "bullish",
      callAt,
      token,
      onToken: { realizedUsd: 5000, stillHoldingRatio: 0.1 },
    }).map((f) => f.kind);
    expect(kinds).toEqual([
      "holder-concentration",
      "thin-liquidity",
      "young-token",
      "smart-money-exit",
      "fresh-wallet-inflow",
      "creator-sold-after-call",
      "creator-took-profit",
    ]);
    expect(
      tokenFlags({
        direction: "bullish",
        callAt,
        token: {
          ...token,
          liquidityUsd: null,
          deployedAt: null,
          topHoldersPct: null,
          flows: null,
          sellersAfterCall: [],
        },
        onToken: null,
      }),
    ).toEqual([]);
  });
});

describe("addressFlags", () => {
  const fake = "0x00e51e3d0f05e8843be6967f0d483c35335e861e";
  const chains = ["monad", "base", "ethereum", "bnb", "arbitrum"];
  const unknown = {
    asset: "PEPE",
    address: fake,
    resolved: null,
    unknownOnMainnets: true,
    checkedChains: chains,
    testnet: null,
  };

  it("calls out a ticker shilled with someone else's address", () => {
    expect(addressFlags(unknown)).toEqual([
      {
        kind: "impostor-token",
        severity: "caution",
        summary:
          "The post says PEPE, but this isn't PEPE's contract. The real PEPE is 0x6982…1933 on Ethereum.",
      },
    ]);
  });

  it("names a testnet deployment, which has no value", () => {
    expect(
      addressFlags({ ...unknown, testnet: { symbol: "PEPE" } }).map(
        (f) => f.kind,
      ),
    ).toEqual(["impostor-token", "testnet-only-contract"]);
  });

  it("flags a different token behind a familiar ticker", () => {
    expect(
      addressFlags({
        ...unknown,
        resolved: { chain: "base", symbol: "FROG" },
        unknownOnMainnets: false,
      })[0]?.summary,
    ).toBe(
      "The post says PEPE, but Nansen identifies this address as FROG. The real PEPE is 0x6982…1933 on Ethereum.",
    );
  });

  it("treats a same-symbol copy as information, and the original as clean", () => {
    expect(
      addressFlags({
        ...unknown,
        resolved: { chain: "bnb", symbol: "PEPE" },
        unknownOnMainnets: false,
      }),
    ).toMatchObject([{ kind: "not-canonical", severity: "info" }]);
    expect(
      addressFlags({
        ...unknown,
        address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
        resolved: { chain: "ethereum", symbol: "PEPE" },
        unknownOnMainnets: false,
      }),
    ).toEqual([]);
  });

  it("never calls an unlisted ticker fake, and claims nothing without answers", () => {
    expect(
      addressFlags({ ...unknown, asset: "FROGGY" }).map((f) => f.kind),
    ).toEqual(["unknown-contract"]);
    expect(
      addressFlags({
        ...unknown,
        unknownOnMainnets: false,
        testnet: { symbol: "PEPE" },
      }),
    ).toEqual([]);
  });
});
