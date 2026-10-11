import { type Address, encodeFunctionData, erc20Abi, parseAbi } from "viem";

export const stakeAbi = parseAbi([
  "function token() view returns (address)",
  "function minimumStake() view returns (uint256)",
  "function withdrawalDelay() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function withdrawableAt(address) view returns (uint256)",
  "function deposit(uint256 amount)",
  "function requestWithdrawal()",
  "function cancelWithdrawal()",
  "function withdraw()",
]);
// Circle's native test USDC, verified against its official address list and RPC.
export const testnetStake = {
  chainId: 10143 as const,
  token: "0x534b2f3A21130d7a60830c2Df862319e593943A3" as Address,
  decimals: 6,
  symbol: "USDC",
  minimum: 500_000_000n,
  cooldown: 604800n,
};
const MAX = (1n << 256n) - 1n;
export function stakeUnits(input: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    throw new Error("invalid_decimals");
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(input) || input.length > 100)
    throw new Error("invalid_amount");
  const [whole = "", fraction = ""] = input.split(".");
  if (fraction.length > decimals) throw new Error("excess_precision");
  const amount = BigInt(whole + fraction.padEnd(decimals, "0"));
  if (amount <= 0n || amount > MAX) throw new Error("invalid_amount");
  return amount;
}
export function depositStep(
  token: Address,
  stake: Address,
  amount: bigint,
  allowance: bigint,
) {
  if (amount <= 0n || amount > MAX) throw new Error("invalid_amount");
  // Reset existing insufficient allowances first; each step needs a fresh user review.
  if (allowance < amount) {
    const reset = allowance > 0n;
    return {
      action: reset ? "resetAllowance" : "approve",
      to: token,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [stake, reset ? 0n : amount],
      }),
    };
  }
  return {
    action: "deposit",
    to: stake,
    data: encodeFunctionData({
      abi: stakeAbi,
      functionName: "deposit",
      args: [amount],
    }),
  };
}
