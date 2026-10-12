import { describe, expect } from "bun:test";
import { TxStatus } from "@chainlink/cre-sdk";
import {
  addContractMock,
  EvmMock,
  HttpActionsMock,
  newTestRuntime,
  test,
} from "@chainlink/cre-sdk/test";
import {
  type Address,
  decodeAbiParameters,
  parseAbiParameters,
  stringToHex,
} from "viem";
import {
  assetSymbol,
  candleStart,
  decimalToUnits,
  initWorkflow,
  onCronTrigger,
  settlementAbi,
} from "./workflow";

const MONAD_TESTNET = 2183018362218727504n;
const SETTLEMENT = "0x1111111111111111111111111111111111111111" as Address;
const config = {
  schedule: "0 0 * * * *",
  chainSelectorName: "monad-testnet",
  settlementAddress: SETTLEMENT,
  gasLimit: "1500000",
  scanLimit: 50,
  maxSettlementsPerRun: 5,
  priceApi: "https://data-api.binance.vision/api/v3/klines",
  symbols: { BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT" },
};
const reportParameters = parseAbiParameters(
  "(bytes32 callId, uint256 entryPrice, uint64 entryTime, uint256 exitPrice, uint64 exitTime)[]",
);
const ETH = stringToHex("ETH", { size: 32 });
const DOGE = stringToHex("DOGE", { size: 32 });
const id = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;

/** Binance-shaped responses keyed by candle open time (ms). */
function mockPrices(prices: Record<string, string>) {
  const http = HttpActionsMock.testInstance();
  const urls: string[] = [];
  http.sendRequest = (input) => {
    urls.push(input.url);
    const start = /startTime=(\d+)/.exec(input.url)?.[1] ?? "";
    const price = prices[start];
    const rows = price ? [[Number(start), price, "0", "0", price]] : [];
    return {
      statusCode: 200,
      body: Buffer.from(JSON.stringify(rows)).toString("base64"),
    };
  };
  return urls;
}

function setup(
  due: {
    callId: `0x${string}`;
    asset: `0x${string}`;
    start: bigint;
    expiry: bigint;
  }[],
) {
  const evm = EvmMock.testInstance(MONAD_TESTNET);
  const contract = addContractMock(evm, {
    address: SETTLEMENT,
    abi: settlementAbi,
  });
  contract.dueCalls = () => [due, BigInt(due.length)];
  const written: Uint8Array[] = [];
  contract.writeReport = (input) => {
    written.push(input.report.rawReport);
    return { txStatus: TxStatus.SUCCESS, txHash: new Uint8Array(32).fill(7) };
  };
  const runtime = newTestRuntime(null, undefined, config);
  return { runtime, written };
}

/** The ABI payload sits after the forwarder metadata header in a raw report. */
function decodeReport(raw: Uint8Array) {
  for (let offset = 0; offset < raw.length; offset += 1) {
    try {
      const hex =
        `0x${Buffer.from(raw.subarray(offset)).toString("hex")}` as const;
      const [settlements] = decodeAbiParameters(reportParameters, hex);
      if (settlements.length > 0) return settlements;
    } catch {}
  }
  throw new Error("No settlement payload in report");
}

describe("pure helpers", () => {
  test("candleStart rounds up to the next minute", () => {
    expect(candleStart(1_800_000_000n)).toBe(1_800_000_000n); // already a whole minute
    expect(candleStart(1_800_000_001n)).toBe(1_800_000_060n);
    expect(candleStart(1_800_000_059n)).toBe(1_800_000_060n);
  });
  test("decimalToUnits is exact and truncates", () => {
    expect(decimalToUnits("2678.20000000")).toBe(267_820_000_000n);
    expect(decimalToUnits("0.123456789")).toBe(12_345_678n);
    expect(() => decimalToUnits("1e5")).toThrow();
  });
  test("assetSymbol strips bytes32 padding", () => {
    expect(assetSymbol(ETH)).toBe("ETH");
  });
});

describe("onCronTrigger", () => {
  test("settles a due call with entry and exit candle opens", () => {
    const start = 1_800_000_000n;
    const expiry = start + 3600n;
    const urls = mockPrices({
      [String(candleStart(start) * 1000n)]: "2000.00000000",
      [String(candleStart(expiry) * 1000n)]: "2100.50000000",
    });
    const { runtime, written } = setup([
      { callId: id(1), asset: ETH, start, expiry },
    ]);
    const result = onCronTrigger(runtime);
    expect(result).toContain("Settled 1");
    expect(urls.every((u) => u.includes("symbol=ETHUSDT&interval=1m"))).toBe(
      true,
    );
    const [settlement] = decodeReport(written[0] as Uint8Array);
    expect(settlement).toEqual({
      callId: id(1),
      entryPrice: 200_000_000_000n,
      entryTime: candleStart(start),
      exitPrice: 210_050_000_000n,
      exitTime: candleStart(expiry),
    });
  });

  test("leaves calls with a missing price or unknown asset for a later run", () => {
    const start = 1_800_000_000n;
    mockPrices({ [String(candleStart(start) * 1000n)]: "2000" });
    const { runtime, written } = setup([
      { callId: id(1), asset: ETH, start, expiry: start + 3600n },
      { callId: id(2), asset: DOGE, start, expiry: start + 3600n },
    ]);
    expect(onCronTrigger(runtime)).toBe("Nothing to settle");
    expect(written).toHaveLength(0);
  });

  test("caps settlements per run", () => {
    const start = 1_800_000_000n;
    const expiry = start + 3600n;
    mockPrices({
      [String(candleStart(start) * 1000n)]: "1",
      [String(candleStart(expiry) * 1000n)]: "2",
    });
    const due = Array.from({ length: 8 }, (_, i) => ({
      callId: id(i + 1),
      asset: ETH,
      start,
      expiry,
    }));
    const { runtime, written } = setup(due);
    expect(onCronTrigger(runtime)).toContain("Settled 5");
    expect(decodeReport(written[0] as Uint8Array)).toHaveLength(5);
  });
});

describe("initWorkflow", () => {
  test("registers one hourly cron handler", () => {
    const handlers = initWorkflow(config);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]?.fn).toBe(onCronTrigger);
  });
});
