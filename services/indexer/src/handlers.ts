import { indexer } from "envio";

indexer.onEvent(
  { contract: "CreatorStake", event: "StakeUpdated" },
  async ({ event, context }) => {
    const contract = event.srcAddress.toLowerCase();
    const wallet = event.params.wallet.toLowerCase();
    const positionId = `${event.chainId}:${contract}:${wallet}`;
    context.StakePosition.set({
      id: positionId,
      chainId: event.chainId,
      contract,
      wallet,
      balance: event.params.balance,
      withdrawableAt: event.params.withdrawableAt,
      updatedAtBlock: BigInt(event.block.number),
      updatedAtTimestamp: BigInt(event.block.timestamp),
    });
    context.StakeEvent.set({
      id: `${event.chainId}:${event.block.number}:${event.logIndex}`,
      positionId,
      balance: event.params.balance,
      withdrawableAt: event.params.withdrawableAt,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
    });
  },
);

// Event identity: chain, block and log index are unique and stable under replay.
const eventId = (event: {
  chainId: number;
  block: { number: number };
  logIndex: number;
}) => `${event.chainId}:${event.block.number}:${event.logIndex}`;

indexer.onEvent(
  { contract: "KuruAccountCore", event: "AccountRegistered" },
  async ({ event, context }) => {
    context.KuruAccount.set({
      id: `${event.chainId}:${event.params.accountId}`,
      chainId: event.chainId,
      accountId: event.params.accountId,
      rootAccountId: event.params.rootAccountId,
      rootOwner: event.params.rootOwner.toLowerCase(),
      registeredAtBlock: BigInt(event.block.number),
    });
  },
);

indexer.onEvent(
  { contract: "KuruOrderBook", event: "SpotSwap" },
  async ({ event, context }) => {
    context.KuruSwap.set({
      id: eventId(event),
      chainId: event.chainId,
      market: event.srcAddress.toLowerCase(),
      accountId: event.params.userId,
      executor: event.params.executor.toLowerCase(),
      isBuy: event.params.isBuy,
      amountIn: event.params.amountInUsed,
      amountOut: event.params.amountOut,
      minAmountOut: event.params.minAmountOut,
      blockNumber: BigInt(event.block.number),
      timestamp: BigInt(event.block.timestamp),
      transactionHash: event.transaction.hash,
    });
  },
);

for (const kind of ["Deposit", "Withdrawal"] as const) {
  indexer.onEvent(
    { contract: "KuruAccountCore", event: kind },
    async ({ event, context }) => {
      context.KuruTransfer.set({
        id: eventId(event),
        chainId: event.chainId,
        kind: kind === "Deposit" ? "deposit" : "withdrawal",
        accountId: event.params.accountId,
        token: event.params.token.toLowerCase(),
        counterparty: ("payer" in event.params
          ? event.params.payer
          : event.params.recipient
        ).toLowerCase(),
        amount: event.params.amount,
        blockNumber: BigInt(event.block.number),
        timestamp: BigInt(event.block.timestamp),
        transactionHash: event.transaction.hash,
      });
    },
  );
}

// CallSettlement: status mirrors the contract's Status enum (index 0 = None).
const bondStatuses = [
  "none",
  "open",
  "success",
  "failure",
  "tie",
  "refunded",
] as const;
const callBondId = (chainId: number, callId: string) =>
  `${chainId}:${callId.toLowerCase()}`;
/** Right-padded bytes32 symbol ("ETH\0…") to text. */
const symbol = (hex: string) =>
  Buffer.from(hex.slice(2), "hex").toString("utf8").replace(/\0+$/, "");

indexer.onEvent(
  { contract: "CallSettlement", event: "CallRegistered" },
  async ({ event, context }) => {
    const p = event.params;
    context.CallBond.set({
      id: callBondId(event.chainId, p.callId),
      chainId: event.chainId,
      contract: event.srcAddress.toLowerCase(),
      callId: p.callId.toLowerCase(),
      creator: p.creator.toLowerCase(),
      asset: symbol(p.asset),
      direction: Number(p.direction) === 0 ? "up" : "down",
      targetBps: Number(p.targetBps),
      start: p.start,
      expiry: p.expiry,
      bond: p.bond,
      reward: p.reward,
      termsHash: p.termsHash.toLowerCase(),
      status: "open",
      entryPrice: undefined,
      exitPrice: undefined,
      payout: undefined,
      slashed: undefined,
      rejections: 0,
      lastRejectionReason: undefined,
      registeredAtBlock: BigInt(event.block.number),
      registeredTx: event.transaction.hash,
      settledAtBlock: undefined,
      settledAt: undefined,
      settledTx: undefined,
    });
  },
);

indexer.onEvent(
  { contract: "CallSettlement", event: "CallSettled" },
  async ({ event, context }) => {
    const id = callBondId(event.chainId, event.params.callId);
    const bond = await context.CallBond.get(id);
    if (!bond) return;
    context.CallBond.set({
      ...bond,
      status: bondStatuses[Number(event.params.outcome)] ?? "none",
      entryPrice: event.params.entryPrice,
      exitPrice: event.params.exitPrice,
      payout: event.params.payout,
      slashed: event.params.slashed,
      settledAtBlock: BigInt(event.block.number),
      settledAt: BigInt(event.block.timestamp),
      settledTx: event.transaction.hash,
    });
  },
);

indexer.onEvent(
  { contract: "CallSettlement", event: "CallRefunded" },
  async ({ event, context }) => {
    const id = callBondId(event.chainId, event.params.callId);
    const bond = await context.CallBond.get(id);
    if (!bond) return;
    context.CallBond.set({
      ...bond,
      status: "refunded",
      payout: event.params.bond,
      settledAtBlock: BigInt(event.block.number),
      settledAt: BigInt(event.block.timestamp),
      settledTx: event.transaction.hash,
    });
  },
);

indexer.onEvent(
  { contract: "CallSettlement", event: "SettlementRejected" },
  async ({ event, context }) => {
    const id = callBondId(event.chainId, event.params.callId);
    const bond = await context.CallBond.get(id);
    if (!bond) return;
    context.CallBond.set({
      ...bond,
      rejections: bond.rejections + 1,
      lastRejectionReason: Number(event.params.reason),
    });
  },
);
