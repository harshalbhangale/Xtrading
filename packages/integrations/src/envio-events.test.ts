import { encodeAbiParameters, encodeEventTopics, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { flowAbi, flowEntrypoint } from "./creator-fees";
import {
  projectEnvioEvents,
  scorecardAddress,
  scorecardEvents,
} from "./envio-events";

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
function settlement(outcome = 2, payout = 0n) {
  return response(
    scorecardAddress,
    encodeAbiParameters(
      [
        { type: "uint8" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [outcome, 100n, 110n, payout, 0n],
    ),
    encodeEventTopics({
      abi: scorecardEvents,
      eventName: "CallSettled",
      args: { callId: hash, creator },
    }),
  );
}
describe("Envio fixed-contract projections", () => {
  it("decodes a bond-free settlement without claiming wallet profit", () => {
    expect(projectEnvioEvents(10143, settlement())[0]).toMatchObject({
      kind: "settlement",
      outcome: "correct",
      entryPrice: "100",
      exitPrice: "110",
      creatorWallet: creator,
      timestamp: "100",
    });
  });
  it("rejects stake payouts and unknown outcomes", () => {
    expect(() => projectEnvioEvents(10143, settlement(2, 1n))).toThrow();
    expect(() => projectEnvioEvents(10143, settlement(5))).toThrow();
  });
  it("rejects a contract on the wrong chain and missing transaction joins", () => {
    expect(() => projectEnvioEvents(143, settlement())).toThrow(
      "unexpected_contract",
    );
    const r = settlement();
    const batch = r.data[0];
    if (!batch) throw new Error("missing batch");
    batch.transactions = [];
    expect(() => projectEnvioEvents(10143, r)).toThrow("missing_event_join");
  });
  it("deduplicates repeated events but rejects conflicting evidence", () => {
    const r = settlement();
    const batch = r.data[0];
    if (!batch) throw new Error("missing batch");
    r.data.push(batch);
    expect(projectEnvioEvents(10143, r)).toHaveLength(1);
    const conflict = settlement(3);
    const altered = conflict.data[0];
    if (!altered) throw new Error("missing batch");
    r.data.push(altered);
    expect(() => projectEnvioEvents(10143, r)).toThrow("conflicting_event");
  });
  it("keeps fee amounts exact above floating point precision", () => {
    const event = flowAbi.find(
      (e) => e.type === "event" && e.name === "FeeCollected",
    );
    expect(event).toBeDefined();
    const topics = encodeEventTopics({
      abi: flowAbi,
      eventName: "FeeCollected",
    });
    // FeeCollected has no indexed fields; encode the declared arguments in ABI order.
    if (event?.type !== "event") throw new Error("missing abi");
    const values = event.inputs.map((i) =>
      i.type === "address"
        ? i.name === "referrer"
          ? creator
          : zeroAddress
        : i.name === "referrerAmount"
          ? 39826357083100000n
          : 0n,
    );
    const data = encodeAbiParameters(event.inputs, values as never);
    expect(
      projectEnvioEvents(143, response(flowEntrypoint, data, topics))[0],
    ).toMatchObject({
      kind: "payment",
      amount: "39826357083100000",
      creatorWallet: creator,
    });
  });
});
