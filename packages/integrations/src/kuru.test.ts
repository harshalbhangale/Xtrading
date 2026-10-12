import { decodeFunctionData, erc20Abi } from "viem";
import { describe, expect, it } from "vitest";
import {
  accountCoreAbi,
  bookEstimate,
  kuruUsdc,
  kuruV2,
  minimumQuotedOutput,
  nextTradeStep,
  orderBookAbi,
  withdrawStep,
} from "./kuru";

const wallet = "0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424" as const;
const base = {
  key: "WETH" as const,
  side: "buy" as const,
  amount: 20_000_000n,
  wallet,
  rootAccountId: 0n,
  accountBalance: 0n,
  walletBalance: 50_000_000n,
  allowance: 0n,
  minimumOutput: 1n,
  deadline: 1_800_000_000n,
};

it("derives bounded slippage protection with integer arithmetic", () => {
  expect(minimumQuotedOutput(100000000000000000001n, 100)).toBe(
    99000000000000000000n,
  );
  expect(() => minimumQuotedOutput(1n, 100)).toThrow();
  expect(() => minimumQuotedOutput(100n, 501)).toThrow();
  expect(() => minimumQuotedOutput(100n, 1.5)).toThrow();
});

describe("nextTradeStep", () => {
  it("approves exactly the shortfall to AccountCore", () => {
    const step = nextTradeStep({ ...base, accountBalance: 5_000_000n });
    expect(step.action).toBe("approve");
    expect(step.to).toBe(kuruUsdc.address);
    expect(decodeFunctionData({ abi: erc20Abi, data: step.data }).args).toEqual(
      [kuruV2.accountCore, 15_000_000n],
    );
  });
  it("deposits the shortfall into the owner's root account", () => {
    const step = nextTradeStep({ ...base, allowance: 20_000_000n });
    expect(step.action).toBe("deposit");
    expect(
      decodeFunctionData({ abi: accountCoreAbi, data: step.data }).args,
    ).toEqual([wallet, kuruUsdc.address, 20_000_000n]);
  });
  it("swaps from the account with a minimum and deadline", () => {
    const step = nextTradeStep({
      ...base,
      rootAccountId: 7n,
      accountBalance: 20_000_000n,
      minimumOutput: 123n,
    });
    expect(step.to).toBe(kuruV2.markets.WETH.market);
    expect(decodeFunctionData({ abi: orderBookAbi, data: step.data })).toEqual({
      functionName: "swap",
      args: [
        7,
        true,
        20_000_000n,
        123n,
        1_800_000_000n,
        {
          builder: "0x0000000000000000000000000000000000000000",
          feePps: 0,
        },
      ],
    });
  });
  it("deposits native MON as payable value, without an approval", () => {
    const amount = 10n ** 18n;
    const step = nextTradeStep({
      ...base,
      key: "MON",
      side: "sell",
      amount,
      walletBalance: 2n * amount,
      accountBalance: 0n,
      allowance: 0n,
    });
    expect(step).toMatchObject({
      action: "deposit",
      to: kuruV2.accountCore,
      value: amount,
    });
    expect(
      decodeFunctionData({ abi: accountCoreAbi, data: step.data }).args,
    ).toEqual([wallet, "0x0000000000000000000000000000000000000000", amount]);
  });
  it("sells base from the account", () => {
    const step = nextTradeStep({
      ...base,
      side: "sell",
      amount: 10n ** 16n,
      rootAccountId: 7n,
      accountBalance: 10n ** 16n,
    });
    const decoded = decodeFunctionData({ abi: orderBookAbi, data: step.data });
    expect(decoded.args?.[1]).toBe(false);
  });
  it("rejects missing funds, accounts and minimums", () => {
    expect(() => nextTradeStep({ ...base, walletBalance: 1n })).toThrow();
    expect(() =>
      nextTradeStep({ ...base, accountBalance: 20_000_000n }),
    ).toThrow("Kuru account required");
    expect(() =>
      nextTradeStep({
        ...base,
        rootAccountId: 7n,
        accountBalance: 20_000_000n,
        minimumOutput: 0n,
      }),
    ).toThrow();
    expect(() => nextTradeStep({ ...base, amount: 0n })).toThrow();
  });
});

it("withdraws to the owner's wallet only", () => {
  const step = withdrawStep({
    rootAccountId: 7n,
    token: kuruUsdc.address,
    amount: 1n,
    wallet,
  });
  expect(
    decodeFunctionData({ abi: accountCoreAbi, data: step.data }).args,
  ).toEqual([7, kuruUsdc.address, 1n, wallet]);
  expect(() =>
    withdrawStep({
      rootAccountId: 0n,
      token: kuruUsdc.address,
      amount: 1n,
      wallet,
    }),
  ).toThrow();
});

describe("bookEstimate", () => {
  // WETH/USDC: price 2680.89 (precision 100), size 0.0055951569 WETH (precision 1e10).
  const book = [
    [267820],
    [55_951_569n],
    [268089, 268143],
    [55_951_569n, 55_940_301n],
  ] as const;
  it("walks asks for buys after the quote-side fee", () => {
    const { output, filled } = bookEstimate({
      key: "WETH",
      side: "buy",
      amountIn: 10_000_000n,
      book,
      takerFeePps: 0n,
    });
    expect(filled).toBe(true);
    // 10 USDC / 2680.89 = 0.0037301[08…] WETH, truncated.
    expect(output / 10n ** 10n).toBe(373010n);
  });
  it("reports unfilled size and applies fees to sell proceeds", () => {
    const sell = bookEstimate({
      key: "WETH",
      side: "sell",
      amountIn: 10n ** 18n,
      book,
      takerFeePps: 7000n,
    });
    expect(sell.filled).toBe(false);
    // 0.0055951569 WETH at 2678.20, less 0.07%.
    expect(sell.output).toBe(14_974_459n);
  });
});
