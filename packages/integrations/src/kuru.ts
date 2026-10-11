import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
  zeroAddress,
} from "viem";

// Published SDK ABI @kuru-labs/kuru-sdk 0.0.95, checked against testnet reads.
export const kuruAbi = parseAbi([
  "function getMarketParams() view returns (uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)",
  "function bestBidAsk() view returns (uint256,uint256)",
  "function placeAndExecuteMarketBuy(uint96 quoteSize,uint256 minOut,bool isMargin,bool isFOK) payable returns (uint256)",
  "function placeAndExecuteMarketSell(uint96 size,uint256 minOut,bool isMargin,bool isFOK) payable returns (uint256)",
]);
export const kuruTestnet = {
  chainId: 10143,
  market: "0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9" as Address,
  base: zeroAddress,
  quote: "0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570" as Address,
};

export function minimumQuotedOutput(expected: bigint, slippageBps: number) {
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 1 ||
    slippageBps > 500 ||
    expected <= 0n
  )
    throw new Error("Invalid quote or slippage");
  const minimum = (expected * BigInt(10000 - slippageBps)) / 10000n;
  if (minimum === 0n) throw new Error("Quote output too small");
  return minimum;
}

export function encodeKuruStep(input: {
  side: "buy" | "sell";
  amount: bigint;
  minimumOutput: bigint;
  pricePrecision: bigint;
  sizePrecision: bigint;
  allowance: bigint;
}) {
  if (
    input.amount <= 0n ||
    input.minimumOutput <= 0n ||
    input.minimumOutput >= 2n ** 256n
  )
    throw new Error("Positive bounded input and minimum output required");
  const buying = input.side === "buy";
  const precision = buying ? input.pricePrecision : input.sizePrecision;
  if (precision <= 0n) throw new Error("Invalid precision");
  const tokenScale = buying ? 10n ** 6n : 10n ** 18n;
  const numerator = input.amount * precision;
  if (numerator % tokenScale !== 0n)
    throw new Error("Amount exceeds market precision");
  const size = numerator / tokenScale;
  if (size === 0n || size >= 2n ** 96n)
    throw new Error("Amount exceeds market bounds");
  if (buying && input.allowance < input.amount) {
    const reset = input.allowance > 0n;
    return {
      action: reset ? "resetAllowance" : "approve",
      to: kuruTestnet.quote,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [kuruTestnet.market, reset ? 0n : input.amount],
      }),
      value: 0n,
    };
  }
  return {
    action: "order",
    to: kuruTestnet.market,
    data: encodeFunctionData({
      abi: kuruAbi,
      functionName: buying
        ? "placeAndExecuteMarketBuy"
        : "placeAndExecuteMarketSell",
      args: [size, input.minimumOutput, false, true],
    }),
    value: buying ? 0n : input.amount,
  };
}
