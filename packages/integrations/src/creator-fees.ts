import {
  type Address,
  decodeEventLog,
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  type Hex,
  parseAbi,
  zeroAddress,
} from "viem";
import { type KuruMarketKey, kuruMainnet, networkTradeTokens } from "./kuru";

// Interfaces/encoding from Kuru-Labs/Kuru-contracts-flow-public. No contract source copied.
export const creatorFeeBps = 50;
export const flowEntrypoint =
  "0xb3e6778480b2E488385E8205eA05E20060B813cb" as Address;
export const flowRouter =
  "0x2f84FB8982073f39Ba47c7fcC29119aF074AbbcB" as Address;
export const flowAbi = parseAbi([
  "struct SwapIntent { address tokenUserBuys; uint256 minAmountUserBuys; address tokenUserSells; uint256 amountUserSells; }",
  "struct FeeCollection { address feeCollectorAddress; uint256 feeBps; address referrerAddress; uint256 referrerFeeBps; bool isInTokenFee; }",
  "function executeSwap(SwapIntent swapIntent, FeeCollection feeCollection, bytes program) payable returns (uint256 amountOut)",
  "function getRouter() view returns (address)",
  "event FeeCollected(address feeCollector, uint256 amount, address referrer, uint256 referrerAmount, address user, address token)",
]);

/** Receipt evidence only; reject logs from another contract, user, recipient or token. */
export function confirmedCreatorPayment(
  logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[],
  expected: { buyer: string; recipient: string; token: string },
): bigint | null {
  const payments: bigint[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== flowEntrypoint.toLowerCase()) continue;
    const signature = log.topics[0];
    if (!signature) continue;
    try {
      const event = decodeEventLog({
        abi: flowAbi,
        data: log.data,
        topics: [signature, ...log.topics.slice(1)],
      });
      if (event.eventName !== "FeeCollected") continue;
      const p = event.args;
      if (
        p.user.toLowerCase() === expected.buyer.toLowerCase() &&
        p.referrer.toLowerCase() === expected.recipient.toLowerCase() &&
        p.token.toLowerCase() === expected.token.toLowerCase() &&
        p.feeCollector === zeroAddress &&
        p.amount === 0n &&
        p.referrerAmount > 0n
      )
        payments.push(p.referrerAmount);
    } catch {
      // Unrelated/malformed event is not payment evidence.
    }
  }
  return payments.length === 1 ? (payments[0] ?? null) : null;
}

/** One configured Kuru order book only. No opaque API route, permits or arbitrary venues. */
export function creatorFeeStep(input: {
  market: KuruMarketKey;
  amount: bigint;
  minimumOutput: bigint;
  allowance: bigint;
  recipient: Address;
}) {
  if (
    input.amount <= 0n ||
    input.minimumOutput <= 0n ||
    input.recipient === zeroAddress
  )
    throw new Error("invalid_creator_fee");
  const tokens = networkTradeTokens(143, input.market, "buy");
  if (input.allowance < input.amount)
    return {
      action: "approve" as const,
      to: tokens.input.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [flowEntrypoint, input.amount],
      }),
      value: 0n,
    };
  const market = kuruMainnet.markets[input.market];
  const program = encodePacked(
    [
      "uint8",
      "address",
      "uint8",
      "uint16",
      "uint8",
      "address",
      "uint8",
      "uint32",
      "uint256",
      "uint8",
    ],
    [
      2,
      tokens.input.address,
      1,
      65535,
      3,
      market.market,
      1,
      Number(market.pricePrecision),
      market.sizePrecision,
      tokens.input.decimals,
    ],
  );
  return {
    action: "swap" as const,
    to: flowEntrypoint,
    value: 0n,
    data: encodeFunctionData({
      abi: flowAbi,
      functionName: "executeSwap",
      args: [
        {
          tokenUserBuys: tokens.output.address,
          minAmountUserBuys: input.minimumOutput,
          tokenUserSells: tokens.input.address,
          amountUserSells: input.amount,
        },
        {
          feeCollectorAddress: zeroAddress,
          feeBps: 0n,
          referrerAddress: input.recipient,
          referrerFeeBps: BigInt(creatorFeeBps),
          isInTokenFee: false,
        },
        program,
      ],
    }),
  };
}
