import { decodeFunctionData, erc20Abi } from "viem";
import { describe, expect, it } from "vitest";
import { depositStep, stakeAbi, stakeUnits } from "./stake";

const token = "0x0000000000000000000000000000000000000001";
const stake = "0x0000000000000000000000000000000000000002";
describe("stake transaction boundaries", () => {
  it("preserves exact decimal units and rejects rounding and ambiguous inputs", () => {
    expect(stakeUnits("500.000001", 6)).toBe(500000001n);
    for (const input of [
      "0",
      "-1",
      "1e3",
      "01",
      "1.",
      " 1",
      "1.0000001",
      "9".repeat(79),
    ])
      expect(() => stakeUnits(input, 6)).toThrow();
  });
  it("approves only the requested amount and requires allowance reset as a separate step", () => {
    const approval = depositStep(token, stake, 500000000n, 0n);
    expect(
      decodeFunctionData({ abi: erc20Abi, data: approval.data }).args,
    ).toEqual([stake, 500000000n]);
    const reset = depositStep(token, stake, 500000000n, 1n);
    expect(reset.action).toBe("resetAllowance");
    expect(
      decodeFunctionData({ abi: erc20Abi, data: reset.data }).args,
    ).toEqual([stake, 0n]);
    const deposit = depositStep(token, stake, 500000000n, 500000000n);
    expect(
      decodeFunctionData({ abi: stakeAbi, data: deposit.data }).functionName,
    ).toBe("deposit");
  });
});
