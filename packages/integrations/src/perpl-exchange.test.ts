import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  type Hex,
} from "viem";
import { describe, expect, it } from "vitest";
import {
  PERPL_TESTNET,
  perplCloseOrder,
  perplCollateralNeeded,
  perplExchangeAbi,
  perplOrderOutcome,
  perplWalletOrder,
  perplWalletSteps,
  perplWithdrawStep,
} from "./perpl-exchange";

const base = {
  requestId: 42n,
  perpId: 32,
  side: "long" as const,
  lots: 5n,
  maxLots: 1000n,
  markPNS: 250_000n,
  slippageBps: 100,
  leverage: 2,
  maxLeverage: 5,
};

describe("perplWalletOrder", () => {
  it("bounds an IOC order by the slippage cap, against the trader", () => {
    const long = perplWalletOrder(base);
    expect(long).toMatchObject({
      orderType: 0,
      immediateOrCancel: true,
      postOnly: false,
      pricePNS: 252_500n,
      lotLNS: 5n,
      leverageHdths: 200n,
    });
    const short = perplWalletOrder({
      ...base,
      side: "short",
      markPNS: 250_001n,
    });
    expect(short.orderType).toBe(1);
    // 250001 * 0.99 = 247500.99, rounded down for a short.
    expect(short.pricePNS).toBe(247_500n);
  });
  it("enforces size, leverage and slippage caps", () => {
    expect(() => perplWalletOrder({ ...base, lots: 1001n })).toThrow();
    expect(() => perplWalletOrder({ ...base, lots: 0n })).toThrow();
    expect(() => perplWalletOrder({ ...base, leverage: 6 })).toThrow();
    expect(() => perplWalletOrder({ ...base, slippageBps: 501 })).toThrow();
    expect(() => perplWalletOrder({ ...base, markPNS: 0n })).toThrow();
  });
});

describe("perplWalletSteps", () => {
  const order = perplWalletOrder(base);
  const needed = perplCollateralNeeded({
    pricePNS: order.pricePNS,
    lots: 5n,
    priceDecimals: 2,
    sizeDecimals: 3,
    leverage: 2,
    takerFeePer100k: 345,
  });
  it("estimates margin with a buffer plus fees", () => {
    // Notional 12.625 AUSD: 1.5x margin at 2x is 9.46875, plus 2x the 0.345% fee.
    expect(needed).toBe(9_555_863n);
  });
  it("opens a new account with an exact approval, then orders from the wallet", () => {
    const steps = perplWalletSteps({
      account: null,
      walletCollateral: 500_000_000n,
      allowance: 0n,
      minAccountOpen: 100_000_000n,
      needed,
      order,
    });
    expect(steps.map((s) => s.kind)).toEqual([
      "approve",
      "create-account",
      "order",
    ]);
    const approve = decodeFunctionData({
      abi: erc20Abi,
      data: steps[0]?.data as Hex,
    });
    expect(approve.args).toEqual([PERPL_TESTNET.exchange, 100_000_000n]);
    const call = decodeFunctionData({
      abi: perplExchangeAbi,
      data: steps[2]?.data as Hex,
    });
    expect(call.functionName).toBe("execOrder");
    expect(steps[2]?.to).toBe(PERPL_TESTNET.exchange);
  });
  it("tops up only the shortfall and skips steps that are not needed", () => {
    const topUp = perplWalletSteps({
      account: { id: 7n, balanceCNS: 5_000_000n },
      walletCollateral: 500_000_000n,
      allowance: 10_000_000n,
      minAccountOpen: 100_000_000n,
      needed,
      order,
    });
    expect(topUp.map((s) => s.kind)).toEqual(["deposit", "order"]);
    expect(
      decodeFunctionData({ abi: perplExchangeAbi, data: topUp[0]?.data as Hex })
        .args,
    ).toEqual([needed - 5_000_000n]);
    const funded = perplWalletSteps({
      account: { id: 7n, balanceCNS: needed },
      walletCollateral: 0n,
      allowance: 0n,
      minAccountOpen: 100_000_000n,
      needed,
      order,
    });
    expect(funded.map((s) => s.kind)).toEqual(["order"]);
  });
  it("refuses a deposit the wallet cannot pay", () => {
    expect(() =>
      perplWalletSteps({
        account: null,
        walletCollateral: 99_000_000n,
        allowance: 0n,
        minAccountOpen: 100_000_000n,
        needed,
        order,
      }),
    ).toThrow("collateral_insufficient");
  });
});

describe("perplOrderOutcome", () => {
  const log = (eventName: string, values: Record<string, unknown>) => {
    const event = perplExchangeAbi.find(
      (item) => item.type === "event" && item.name === eventName,
    );
    if (event?.type !== "event") throw new Error(eventName);
    return {
      address: PERPL_TESTNET.exchange.toLowerCase(),
      topics: encodeEventTopics({ abi: [event] }) as Hex[],
      data: encodeAbiParameters(
        event.inputs,
        event.inputs.map(
          (input) => values[input.name as string] ?? 0n,
        ) as never,
      ),
    };
  };
  const request = (accountId: bigint, orderDescId: bigint) =>
    log("OrderRequestV2", {
      accountId,
      orderDescId,
      orderType: 0,
      postOnly: false,
      fillOrKill: false,
      immediateOrCancel: true,
      extension: "0x",
    });
  const fill = (price: bigint, lots: bigint) =>
    log("TakerOrderFilledV2", {
      entryPricePNS: price,
      lotLNS: lots,
      feeCNS: 10n,
      amountCNS: -1n,
    });

  it("sums this account's fills and averages the price", () => {
    expect(
      perplOrderOutcome({
        logs: [request(7n, 42n), fill(100n, 1n), fill(130n, 2n)],
        accountId: 7n,
        orderDescId: 42n,
      }),
    ).toEqual({
      found: true,
      filledLots: 3n,
      averagePricePNS: 120n,
      feeCNS: 20n,
      failedReason: null,
    });
  });
  it("ignores another account's order and logs from other contracts", () => {
    const foreign = {
      ...fill(100n, 1n),
      address: "0x0000000000000000000000000000000000000001",
    };
    expect(
      perplOrderOutcome({
        logs: [request(8n, 42n), fill(100n, 1n), foreign],
        accountId: 7n,
        orderDescId: 42n,
      }),
    ).toMatchObject({ found: false, filledLots: 0n });
  });
  it("reports an order that was accepted but not filled", () => {
    expect(
      perplOrderOutcome({
        logs: [request(7n, 42n), log("OrderPostFailed", { reason: 3n })],
        accountId: 7n,
        orderDescId: 42n,
      }),
    ).toMatchObject({ found: true, filledLots: 0n, failedReason: 3n });
  });
});

describe("closes and withdrawals", () => {
  it("closes with a reduce-only order bounded against the trader", () => {
    const close = {
      requestId: 9n,
      perpId: 32,
      lots: 3n,
      markPNS: 250_001n,
      slippageBps: 100,
    };
    const long = perplCloseOrder({ ...close, position: "long" });
    // Closing a long sells: CloseLong, limit rounded down below the mark.
    expect(long).toMatchObject({
      orderType: 2,
      lotLNS: 3n,
      pricePNS: 247_500n,
      immediateOrCancel: true,
    });
    const short = perplCloseOrder({ ...close, position: "short" });
    // Closing a short buys: CloseShort, limit rounded up above the mark.
    expect(short).toMatchObject({ orderType: 3, pricePNS: 252_502n });
    expect(() =>
      perplCloseOrder({ ...close, position: "long", lots: 0n }),
    ).toThrow();
  });
  it("withdraws only free balance, to the signing wallet", () => {
    const step = perplWithdrawStep(5_000_000n, 9_000_000n);
    expect(step.to).toBe(PERPL_TESTNET.exchange);
    expect(
      decodeFunctionData({ abi: perplExchangeAbi, data: step.data }),
    ).toMatchObject({
      functionName: "withdrawCollateral",
      args: [5_000_000n],
    });
    expect(() => perplWithdrawStep(9_000_001n, 9_000_000n)).toThrow(
      "amount_above_available",
    );
  });
});
