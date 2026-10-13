import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import {
  decodeMainnetMarketOrder,
  kuruMainnet,
  kuruV1OrderBookAbi,
  kuruV2,
  mainnetOrderSize,
} from "./kuru";

const mon = kuruMainnet.markets.MON.market;
const minOut = 1n;

function calldata(
  side: "buy" | "sell",
  size: bigint,
  overrides: { isMargin?: boolean; isFillOrKill?: boolean } = {},
) {
  return encodeFunctionData({
    abi: kuruV1OrderBookAbi,
    functionName:
      side === "buy" ? "placeAndExecuteMarketBuy" : "placeAndExecuteMarketSell",
    args: [
      size,
      minOut,
      overrides.isMargin ?? false,
      overrides.isFillOrKill ?? false,
    ],
  });
}

describe("decodeMainnetMarketOrder", () => {
  it("recovers the input amount the app sized for a USDC buy", () => {
    const { size, spend } = mainnetOrderSize({
      key: "MON",
      side: "buy",
      amount: 1_000_000n,
    });
    const decoded = decodeMainnetMarketOrder({
      to: mon,
      data: calldata("buy", size),
    });
    expect(decoded).toEqual({
      key: "MON",
      marketAddress: mon.toLowerCase(),
      side: "buy",
      inputAmount: spend,
      minAmountOut: minOut,
    });
  });

  it("recovers the input amount the app sized for a sell", () => {
    const amount = 2_500_000_000_000_000_000n;
    const { size, spend } = mainnetOrderSize({
      key: "MON",
      side: "sell",
      amount,
    });
    const decoded = decodeMainnetMarketOrder({
      to: mon,
      data: calldata("sell", size),
    });
    expect(decoded?.side).toBe("sell");
    expect(decoded?.inputAmount).toBe(spend);
  });

  it("refuses margin or fill-or-kill orders, which are not spot market orders", () => {
    const { size } = mainnetOrderSize({
      key: "MON",
      side: "buy",
      amount: 1_000_000n,
    });
    expect(
      decodeMainnetMarketOrder({
        to: mon,
        data: calldata("buy", size, { isMargin: true }),
      }),
    ).toBeNull();
    expect(
      decodeMainnetMarketOrder({
        to: mon,
        data: calldata("buy", size, { isFillOrKill: true }),
      }),
    ).toBeNull();
  });

  it("refuses orders sent to a testnet market or to an unconfigured address", () => {
    const { size } = mainnetOrderSize({
      key: "MON",
      side: "buy",
      amount: 1_000_000n,
    });
    const testnetMarket = kuruV2.markets.MON.market;
    expect(
      decodeMainnetMarketOrder({
        to: testnetMarket,
        data: calldata("buy", size),
      }),
    ).toBeNull();
    expect(
      decodeMainnetMarketOrder({
        to: "0x0000000000000000000000000000000000000001",
        data: calldata("buy", size),
      }),
    ).toBeNull();
  });

  it("refuses calls that are not market orders and missing targets", () => {
    const approve = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ] as const,
      functionName: "approve",
      args: [mon, 1n],
    });
    expect(decodeMainnetMarketOrder({ to: mon, data: approve })).toBeNull();
    expect(
      decodeMainnetMarketOrder({ to: null, data: calldata("buy", 1n) }),
    ).toBeNull();
  });
});
