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
