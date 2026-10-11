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
