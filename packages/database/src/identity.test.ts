import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import { bindingMessage, verifyWalletProof } from "./identity";

describe("wallet ownership proof", () => {
  it("accepts the owner and rejects another signer or changed binding context", async () => {
    const owner = privateKeyToAccount(generatePrivateKey());
    const other = privateKeyToAccount(generatePrivateKey());
    const input = {
      origin: "https://cmb.example",
      wallet: owner.address,
      xUserId: "12345",
      privyUserId: "did:privy:test",
      chainId: 10143,
      nonce: "0123456789",
      issuedAt: new Date("2026-10-11T12:00:00Z"),
      expiresAt: new Date("2026-10-11T12:05:00Z"),
    };
    const message = bindingMessage(input);
    const signature = await owner.signMessage({ message });
    expect(await verifyWalletProof(owner.address, message, signature)).toBe(
      true,
    );
    expect(await verifyWalletProof(other.address, message, signature)).toBe(
      false,
    );
    for (const change of [
      { chainId: 143 },
      { origin: "https://other.example" },
      { xUserId: "67890" },
      { privyUserId: "did:privy:other" },
      { nonce: "changed" },
    ]) {
      expect(
        await verifyWalletProof(
          owner.address,
          bindingMessage({ ...input, ...change }),
          signature,
        ),
      ).toBe(false);
    }
    expect(await verifyWalletProof(owner.address, message, "0xdeadbeef")).toBe(
      false,
    );
  });
});
