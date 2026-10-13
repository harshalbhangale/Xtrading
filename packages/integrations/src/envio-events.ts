import { decodeEventLog, parseAbi } from "viem";
import { z } from "zod";
import { flowAbi, flowEntrypoint } from "./creator-fees";

export const scorecardAddress = "0x836aa86c5b013f2fbbe0fc960e88677d4c106bb9";
export const scorecardEvents = parseAbi([
  "event CallSettled(bytes32 indexed callId, address indexed creator, uint8 outcome, uint256 entryPrice, uint256 exitPrice, uint256 payout, uint256 slashed)",
]);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const hyperSyncResponse = z.object({
  archive_height: integer,
  next_block: integer,
  data: z
    .array(
      z.object({
        blocks: z
          .array(
            z.object({
              number: integer,
              hash,
              timestamp: z.union([
                integer,
                z.string().regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/),
              ]),
            }),
          )
          .max(5000),
        transactions: z
          .array(
            z.object({
              block_number: integer,
              transaction_index: integer,
              hash,
            }),
          )
          .max(5000),
        logs: z
          .array(
            z.object({
              block_number: integer,
              transaction_index: integer,
              log_index: integer,
              address,
              data: hex,
              topic0: hash,
              topic1: hash.nullish(),
              topic2: hash.nullish(),
              topic3: hash.nullish(),
            }),
          )
          .max(5000),
      }),
    )
    .max(20),
});
export type EnvioEvent = {
  id: string;
  chainId: 143 | 10143;
  contract: string;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  timestamp: string;
  logIndex: number;
  rawData: `0x${string}`;
  topics: [`0x${string}`, ...`0x${string}`[]];
} & (
  | {
      kind: "payment";
      buyer: string;
      creatorWallet: string;
      token: string;
      amount: string;
    }
  | {
      kind: "settlement";
      creatorWallet: string;
      callId: string;
      outcome: "correct" | "incorrect" | "flat";
      entryPrice: string;
      exitPrice: string;
    }
);

/** Fixed-contract projections. Missing joins, wrong chains and conflicting duplicates fail closed. */
export function projectEnvioEvents(
  chainId: 143 | 10143,
  input: unknown,
): EnvioEvent[] {
  const response = hyperSyncResponse.parse(input);
  const records = new Map<string, EnvioEvent>();
  for (const batch of response.data) {
    const blocks = new Map(batch.blocks.map((b) => [b.number, b]));
    const transactions = new Map(
      batch.transactions.map((t) => [
        `${t.block_number}:${t.transaction_index}`,
        t,
      ]),
    );
    for (const log of batch.logs) {
      const expected =
        chainId === 143 ? flowEntrypoint.toLowerCase() : scorecardAddress;
      if (log.address.toLowerCase() !== expected)
        throw new Error("unexpected_contract");
      const block = blocks.get(log.block_number);
      const transaction = transactions.get(
        `${log.block_number}:${log.transaction_index}`,
      );
      if (!block || !transaction) throw new Error("missing_event_join");
      const topics = [log.topic0, log.topic1, log.topic2, log.topic3].filter(
        (t): t is `0x${string}` => Boolean(t),
      ) as [`0x${string}`, ...`0x${string}`[]];
      const base = {
        id: `${chainId}:${transaction.hash.toLowerCase()}:${log.log_index}`,
        chainId,
        contract: expected,
        transactionHash: transaction.hash.toLowerCase(),
        blockHash: block.hash.toLowerCase(),
        blockNumber: String(block.number),
        timestamp: BigInt(block.timestamp).toString(),
        logIndex: log.log_index,
        rawData: log.data as `0x${string}`,
        topics,
      };
      let event: EnvioEvent;
      if (chainId === 143) {
        const decoded = decodeEventLog({
          abi: flowAbi,
          topics,
          data: base.rawData,
          eventName: "FeeCollected",
        });
        if (decoded.args.referrerAmount === 0n) continue;
        event = {
          ...base,
          kind: "payment",
          buyer: decoded.args.user.toLowerCase(),
          creatorWallet: decoded.args.referrer.toLowerCase(),
          token: decoded.args.token.toLowerCase(),
          amount: decoded.args.referrerAmount.toString(),
        };
      } else {
        const { args } = decodeEventLog({
          abi: scorecardEvents,
          topics,
          data: base.rawData,
        });
        // Only the bond-free scorecard belongs to this product. No stake/reward accounting.
        if (
          args.payout !== 0n ||
          args.slashed !== 0n ||
          ![2, 3, 4].includes(args.outcome)
        )
          throw new Error("invalid_scorecard_outcome");
        event = {
          ...base,
          kind: "settlement",
          creatorWallet: args.creator.toLowerCase(),
          callId: args.callId.toLowerCase(),
          outcome:
            args.outcome === 2
              ? "correct"
              : args.outcome === 3
                ? "incorrect"
                : "flat",
          entryPrice: args.entryPrice.toString(),
          exitPrice: args.exitPrice.toString(),
        };
      }
      const prior = records.get(event.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(event))
        throw new Error("conflicting_event");
      records.set(event.id, event);
    }
  }
  return [...records.values()];
}
