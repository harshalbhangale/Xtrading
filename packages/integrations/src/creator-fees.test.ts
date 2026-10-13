import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  zeroAddress,
} from "viem";
import { expect, it } from "vitest";
import {
  confirmedCreatorPayment,
  creatorFeeStep,
  flowAbi,
  flowEntrypoint,
} from "./creator-fees";
import { kuruMainnet } from "./kuru";

const recipient = "0x000000000000000000000000000000000000beef" as const;
it("confirms only an unambiguous payment from the fixed contract to the reviewed creator", () => {
  const buyer = "0x0000000000000000000000000000000000001234" as const;
  const payment = {
    address: flowEntrypoint,
    topics: [encodeEventTopics({ abi: flowAbi, eventName: "FeeCollected" })[0]],
    data: encodeAbiParameters(
      [
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
      ],
      [zeroAddress, 0n, recipient, 100n, buyer, zeroAddress],
    ),
  };
  const expected = { buyer, recipient, token: zeroAddress };
  expect(confirmedCreatorPayment([payment], expected)).toBe(100n);
  expect(
    confirmedCreatorPayment([{ ...payment, address: recipient }], expected),
  ).toBeNull();
  expect(
    confirmedCreatorPayment([payment], { ...expected, recipient: buyer }),
  ).toBeNull();
  expect(
    confirmedCreatorPayment([payment], { ...expected, buyer: recipient }),
  ).toBeNull();
  expect(
    confirmedCreatorPayment([payment], { ...expected, token: recipient }),
  ).toBeNull();
  expect(confirmedCreatorPayment([payment, payment], expected)).toBeNull();
});
it("approves only the exact budget to the fixed entrypoint", () => {
  const step = creatorFeeStep({
    market: "MON",
    amount: 1000000n,
    minimumOutput: 1n,
    allowance: 0n,
    recipient,
  });
  expect(step.action).toBe("approve");
  expect(decodeFunctionData({ abi: erc20Abi, data: step.data }).args).toEqual([
    flowEntrypoint,
    1000000n,
  ]);
});
it("pins the input, output, recipient, 50bps and a single Kuru market", () => {
  const step = creatorFeeStep({
    market: "MON",
    amount: 1000000n,
    minimumOutput: 123n,
    allowance: 1000000n,
    recipient,
  });
  const decoded = decodeFunctionData({ abi: flowAbi, data: step.data });
  expect(decoded.functionName).toBe("executeSwap");
  if (decoded.functionName !== "executeSwap")
    throw new Error("Unexpected call");
  expect(decoded.args?.[0]).toEqual({
    tokenUserBuys: zeroAddress,
    minAmountUserBuys: 123n,
    tokenUserSells: kuruMainnet.quote.address,
    amountUserSells: 1000000n,
  });
  expect(decoded.args?.[1].referrerFeeBps).toBe(50n);
  expect(decoded.args?.[1].isInTokenFee).toBe(false);
  expect(decoded.args?.[2].toLowerCase()).toContain(
    kuruMainnet.markets.MON.market.slice(2).toLowerCase(),
  );
  expect(step.to).toBe(flowEntrypoint);
});
it("rejects empty recipients and zero amounts", () => {
  expect(() =>
    creatorFeeStep({
      market: "MON",
      amount: 1n,
      minimumOutput: 1n,
      allowance: 1n,
      recipient: zeroAddress,
    }),
  ).toThrow();
});
