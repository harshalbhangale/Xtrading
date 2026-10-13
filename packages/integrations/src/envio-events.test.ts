import { encodeAbiParameters, encodeEventTopics, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { flowAbi, flowEntrypoint } from "./creator-fees";
import { projectEnvioEvents } from "./envio-events";

const creator = "0x51bdfc2a4d1c3b04a89f8ca928bd377b767df424";
const hash = `0x${"11".repeat(32)}` as const;
function response(address: string, data: string, topics: readonly unknown[]) {
  return {
    archive_height: 200,
    next_block: 101,
    data: [
      {
        blocks: [{ number: 100, hash, timestamp: "0x64" }],
        transactions: [{ block_number: 100, transaction_index: 2, hash }],
        logs: [
          {
            address,
            data,
            topic0: topics[0],
            topic1: topics[1],
            topic2: topics[2],
            block_number: 100,
            transaction_index: 2,
            log_index: 3,
          },
        ],
      },
    ],
  };
}
function payment(referrerAmount = 39826357083100000n) {
  const event = flowAbi.find(
    (e) => e.type === "event" && e.name === "FeeCollected",
  );
  // FeeCollected has no indexed fields; encode the declared arguments in ABI order.
  if (event?.type !== "event") throw new Error("missing abi");
  const values = event.inputs.map((i) =>
    i.type === "address"
      ? i.name === "referrer"
        ? creator
        : zeroAddress
      : i.name === "referrerAmount"
        ? referrerAmount
        : 0n,
  );
  return response(
    flowEntrypoint,
    encodeAbiParameters(event.inputs, values as never),
    encodeEventTopics({ abi: flowAbi, eventName: "FeeCollected" }),
  );
}
describe("Envio fixed-contract projections", () => {
  it("keeps fee amounts exact above floating point precision", () => {
    expect(projectEnvioEvents(143, payment())[0]).toMatchObject({
      kind: "payment",
      amount: "39826357083100000",
      creatorWallet: creator,
      timestamp: "100",
    });
  });
  it("skips fee events without a creator payment", () => {
    expect(projectEnvioEvents(143, payment(0n))).toHaveLength(0);
  });
  it("rejects an unexpected contract and missing transaction joins", () => {
    const other = payment();
    const log = other.data[0]?.logs[0];
    if (!log) throw new Error("missing log");
    log.address = `0x${"22".repeat(20)}`;
    expect(() => projectEnvioEvents(143, other)).toThrow("unexpected_contract");
    const r = payment();
    const batch = r.data[0];
    if (!batch) throw new Error("missing batch");
    batch.transactions = [];
    expect(() => projectEnvioEvents(143, r)).toThrow("missing_event_join");
  });
  it("deduplicates repeated events but rejects conflicting evidence", () => {
    const r = payment();
    const batch = r.data[0];
    if (!batch) throw new Error("missing batch");
    r.data.push(batch);
    expect(projectEnvioEvents(143, r)).toHaveLength(1);
    const altered = payment(1n).data[0];
    if (!altered) throw new Error("missing batch");
    r.data.push(altered);
    expect(() => projectEnvioEvents(143, r)).toThrow("conflicting_event");
  });
});
