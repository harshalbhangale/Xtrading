import {
  bytesToHex,
  consensusMedianAggregation,
  cre,
  encodeCallMsg,
  getNetwork,
  hexToBase64,
  LAST_FINALIZED_BLOCK_NUMBER,
  type NodeRuntime,
  type Runtime,
  TxStatus,
} from "@chainlink/cre-sdk";
import {
  type Address,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  hexToString,
  parseAbi,
  parseAbiParameters,
  zeroAddress,
} from "viem";
import { z } from "zod";

/**
 * Hourly settlement of expired bonded calls (methodology directional-return-v1).
 *
 * 1. Read due calls from CallSettlement at a finalized block (bounded scan).
 * 2. For each, fetch the open of the first 1-minute candle at or after the window's
 *    start and expiry. Every node fetches independently; the median is agreed.
 * 3. Sign one batch report and write it through the Chainlink forwarder.
 *
 * Prices are integers with 8 decimals. A missing candle leaves the call open for the
 * next run; the contract never slashes on a missing price.
 */
export const configSchema = z.object({
  schedule: z.string(),
  chainSelectorName: z.string(),
  settlementAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  gasLimit: z.string().regex(/^[0-9]+$/),
  scanLimit: z.number().int().min(1).max(200),
  maxSettlementsPerRun: z.number().int().min(1).max(20),
  // zod .url() needs the URL global, which the CRE WASM runtime lacks.
  priceApi: z.string().regex(/^https:\/\/[^\s?#]+$/),
  symbols: z.record(z.string(), z.string()),
});
type Config = z.infer<typeof configSchema>;

export const settlementAbi = parseAbi([
  "struct DueCall { bytes32 callId; bytes32 asset; uint64 start; uint64 expiry; }",
  "function dueCalls(uint256 cursor, uint256 limit) view returns (DueCall[] due, uint256 next)",
]);
const reportParameters = parseAbiParameters(
  "(bytes32 callId, uint256 entryPrice, uint64 entryTime, uint256 exitPrice, uint64 exitTime)[]",
);

export const PRICE_DECIMALS = 8;
/** First 1-minute candle starting at or after `timestamp`. */
export const candleStart = (timestamp: bigint) =>
  ((timestamp + 59n) / 60n) * 60n;

/** Exact decimal text to integer units with `decimals` places, truncated. */
export function decimalToUnits(
  text: string,
  decimals = PRICE_DECIMALS,
): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) throw new Error(`Invalid price: ${text}`);
  const fraction = (match[2] ?? "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${match[1]}${fraction}`);
}

/** Asset symbol stored as a right-padded bytes32 ("ETH" -> "ETH"). */
export const assetSymbol = (asset: `0x${string}`) =>
  hexToString(asset, { size: 32 }).replace(/\0+$/, "");

/**
 * Node-mode price fetch. Returns 0 when the candle is missing or not the expected
 * minute, which consensus then reports as unavailable.
 */
export const fetchCandleOpen = (
  nodeRuntime: NodeRuntime<Config>,
  symbol: string,
  start: bigint,
): bigint => {
  const http = new cre.capabilities.HTTPClient();
  const url = `${nodeRuntime.config.priceApi}?symbol=${symbol}&interval=1m&startTime=${start * 1000n}&limit=1`;
  const response = http
    .sendRequest(nodeRuntime, { url, method: "GET" })
    .result();
  if (response.statusCode !== 200) return 0n;
  const rows = JSON.parse(new TextDecoder().decode(response.body)) as [
    number,
    string,
  ][];
  const row = rows[0];
  if (!row || BigInt(row[0]) !== start * 1000n) return 0n;
  return decimalToUnits(row[1]);
};

export type Settlement = {
  callId: `0x${string}`;
  entryPrice: bigint;
  entryTime: bigint;
  exitPrice: bigint;
  exitTime: bigint;
};

export const onCronTrigger = (runtime: Runtime<Config>): string => {
  const config = runtime.config;
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  });
  if (!network)
    throw new Error(`Network not found: ${config.chainSelectorName}`);
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const receiver = config.settlementAddress as Address;

  const read = evm
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: receiver,
        data: encodeFunctionData({
          abi: settlementAbi,
          functionName: "dueCalls",
          args: [0n, BigInt(config.scanLimit)],
        }),
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result();
  const [due] = decodeFunctionResult({
    abi: settlementAbi,
    functionName: "dueCalls",
    data: bytesToHex(read.data),
  }) as readonly [
    readonly {
      callId: `0x${string}`;
      asset: `0x${string}`;
      start: bigint;
      expiry: bigint;
    }[],
    bigint,
  ];
  runtime.log(`Due calls: ${due.length}`);

  const settlements: Settlement[] = [];
  for (const call of due.slice(0, config.maxSettlementsPerRun)) {
    const symbol = config.symbols[assetSymbol(call.asset)];
    if (!symbol) {
      runtime.log(
        `Skipping ${call.callId}: no price source for ${assetSymbol(call.asset)}`,
      );
      continue;
    }
    const entryTime = candleStart(call.start);
    const exitTime = candleStart(call.expiry);
    const price = (at: bigint) =>
      runtime
        .runInNodeMode(fetchCandleOpen, consensusMedianAggregation())(
          symbol,
          at,
        )
        .result();
    const entryPrice = price(entryTime);
    const exitPrice = price(exitTime);
    if (entryPrice === 0n || exitPrice === 0n) {
      runtime.log(`Price unavailable for ${call.callId}; retrying next run`);
      continue;
    }
    settlements.push({
      callId: call.callId,
      entryPrice,
      entryTime,
      exitPrice,
      exitTime,
    });
    runtime.log(
      `${call.callId} ${symbol}: entry ${entryPrice} at ${entryTime}, exit ${exitPrice} at ${exitTime}`,
    );
  }
  if (settlements.length === 0) return "Nothing to settle";

  const payload = encodeAbiParameters(reportParameters, [settlements]);
  const report = runtime
    .report({
      encodedPayload: hexToBase64(payload),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();
  const write = evm
    .writeReport(runtime, {
      receiver,
      report,
      gasConfig: { gasLimit: config.gasLimit },
    })
    .result();
  if (write.txStatus !== TxStatus.SUCCESS) {
    throw new Error(
      `Settlement write failed: ${write.errorMessage || write.txStatus}`,
    );
  }
  const txHash = bytesToHex(write.txHash || new Uint8Array(32));
  runtime.log(`Settled ${settlements.length} call(s). TX: ${txHash}`);
  return `Settled ${settlements.length} — tx: ${txHash}`;
};

export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [
    cre.handler(cron.trigger({ schedule: config.schedule }), onCronTrigger),
  ];
}
