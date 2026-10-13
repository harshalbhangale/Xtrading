import { decodeFunctionData, erc20Abi, zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { kuruMainnetUsdc, kuruUsdc, kuruV2 } from "./kuru";
import {
  prepareTransferSchema,
  TransferError,
  transferStep,
  walletToken,
  walletTokens,
} from "./wallet";

const from = "0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424" as const;
const recipient = "0x1111111111111111111111111111111111111111" as const;

describe("wallet transfers", () => {
  it("keeps tokens per chain and never mixes networks", () => {
    expect(walletToken(10143, "USDC")).toEqual(kuruUsdc);
    expect(walletToken(143, "USDC")).toEqual(kuruMainnetUsdc);
    expect(walletTokens(143).map((t) => t.symbol)).toContain("cbBTC");
    expect(walletToken(10143, "cbBTC")).toBeUndefined();
    expect(walletTokens(10143)[0]?.address).toBe(zeroAddress);
    expect(walletToken(10143, "AUSD")?.address).toBe(
      "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
    );
    expect(walletToken(143, "AUSD")).toBeUndefined();
  });

  it("sends native MON as value with empty calldata", () => {
    const step = transferStep({
      token: kuruV2.markets.MON.base,
      from,
      recipient,
      amount: 5n,
    });
    expect(step).toEqual({ to: recipient, data: "0x", value: 5n });
  });

  it("encodes an exact ERC-20 transfer to the token contract", () => {
    const step = transferStep({
      token: kuruUsdc,
      from,
      recipient,
      amount: 123n,
    });
    expect(step.to).toBe(kuruUsdc.address);
    expect(step.value).toBe(0n);
    const decoded = decodeFunctionData({ abi: erc20Abi, data: step.data });
    expect(decoded.functionName).toBe("transfer");
    expect(decoded.args).toEqual([recipient, 123n]);
  });

  it("rejects recipients that lose funds", () => {
    const code = (recipientAddress: `0x${string}`) => {
      try {
        transferStep({
          token: kuruUsdc,
          from,
          recipient: recipientAddress,
          amount: 1n,
        });
      } catch (error) {
        return error instanceof TransferError ? error.code : "other";
      }
      return "ok";
    };
    expect(code(zeroAddress)).toBe("invalid_recipient");
    expect(code(from)).toBe("recipient_is_sender");
    expect(code(kuruUsdc.address)).toBe("recipient_is_token_contract");
  });

  it("accepts only integer unit strings and valid addresses", () => {
    const base = { chainId: 10143, from, to: recipient, token: "MON" };
    expect(
      prepareTransferSchema.safeParse({ ...base, amount: "1" }).success,
    ).toBe(true);
    for (const amount of ["0", "1.5", "-1", "1e18", ""])
      expect(prepareTransferSchema.safeParse({ ...base, amount }).success).toBe(
        false,
      );
    expect(
      prepareTransferSchema.safeParse({ ...base, amount: "1", to: "0x1234" })
        .success,
    ).toBe(false);
    expect(
      prepareTransferSchema.safeParse({ ...base, amount: "1", chainId: 1 })
        .success,
    ).toBe(false);
  });
});
