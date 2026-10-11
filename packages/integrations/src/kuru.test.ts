import { decodeFunctionData, erc20Abi } from "viem";
import { expect, it } from "vitest";
import { encodeKuruStep, kuruAbi, kuruTestnet } from "./kuru";

const base = {
  side: "buy" as const,
  amount: 1000000n,
  minimumOutput: 10n ** 18n,
  pricePrecision: 100000000n,
  sizePrecision: 10000000000n,
  allowance: 1000000n,
};
it("converts token units into Kuru precision and enforces FOK with bounded output", () => {
  const buy = encodeKuruStep(base);
  expect(decodeFunctionData({ abi: kuruAbi, data: buy.data })).toMatchObject({
    functionName: "placeAndExecuteMarketBuy",
    args: [100000000n, 10n ** 18n, false, true],
  });
  const sell = encodeKuruStep({
    ...base,
    side: "sell",
    amount: 10n ** 18n,
    minimumOutput: 1000000n,
  });
  expect(sell.value).toBe(10n ** 18n);
  expect(decodeFunctionData({ abi: kuruAbi, data: sell.data })).toMatchObject({
    functionName: "placeAndExecuteMarketSell",
    args: [10000000000n, 1000000n, false, true],
  });
});
it("requires separate reset and exact approval without using the stake token", () => {
  const approval = encodeKuruStep({ ...base, allowance: 0n });
  expect(approval.to).toBe(kuruTestnet.quote);
  expect(
    decodeFunctionData({ abi: erc20Abi, data: approval.data }).args,
  ).toEqual([kuruTestnet.market, 1000000n]);
  const reset = encodeKuruStep({ ...base, allowance: 1n });
  expect(reset.action).toBe("resetAllowance");
  expect(decodeFunctionData({ abi: erc20Abi, data: reset.data }).args).toEqual([
    kuruTestnet.market,
    0n,
  ]);
});
it("rejects zero output, oversized orders and precision truncation", () => {
  expect(() => encodeKuruStep({ ...base, minimumOutput: 0n })).toThrow();
  expect(() => encodeKuruStep({ ...base, amount: 2n ** 96n })).toThrow();
  expect(() => encodeKuruStep({ ...base, side: "sell", amount: 1n })).toThrow(
    "precision",
  );
});
