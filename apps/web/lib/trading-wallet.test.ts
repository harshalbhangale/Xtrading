import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { tradingWallet } = await import("./trading-wallet");

const A = "0x1111111111111111111111111111111111111111";
const B = "0x2222222222222222222222222222222222222222";
const service = (wallet: string | null) =>
  ({ current: async () => (wallet ? { wallet } : null) }) as never;
const req = (wallet?: string) =>
  new Request(
    "http://x",
    wallet ? { headers: { "x-trading-wallet": wallet } } : {},
  );

describe("tradingWallet", () => {
  it("needs no X binding for a user with one wallet", async () => {
    expect(
      await tradingWallet(
        req(),
        { privyUserId: "u", wallets: [A] },
        service(null),
      ),
    ).toBe(A);
  });
  it("uses the wallet the browser signs with, if it is linked to the login", async () => {
    expect(
      await tradingWallet(
        req(B.toUpperCase().replace("0X", "0x")),
        { privyUserId: "u", wallets: [A, B] },
        service(null),
      ),
    ).toBe(B);
    await expect(
      tradingWallet(req(B), { privyUserId: "u", wallets: [A] }, service(null)),
    ).rejects.toMatchObject({ code: "wallet_not_linked" });
  });
  it("asks which wallet when several are linked and none is chosen", async () => {
    await expect(
      tradingWallet(
        req(),
        { privyUserId: "u", wallets: [A, B] },
        service(null),
      ),
    ).rejects.toMatchObject({ code: "wallet_choice_required" });
    await expect(
      tradingWallet(req(), { privyUserId: "u", wallets: [] }, service(null)),
    ).rejects.toMatchObject({ code: "wallet_required" });
  });
  it("still honours an existing binding when nothing else is said", async () => {
    expect(
      await tradingWallet(
        req(),
        { privyUserId: "u", wallets: [A, B] },
        service(B),
      ),
    ).toBe(B);
  });
});
