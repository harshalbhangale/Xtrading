import {
  kuruMainnet,
  kuruV1OrderBookAbi,
} from "@call-my-bluff/integrations/kuru";
import {
  decodeFunctionData,
  encodeAbiParameters,
  erc20Abi,
  type Hex,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wallet = vi.hoisted(() => ({
  handler: (_m: string, _p: unknown[]) => null as unknown,
}));
vi.mock("./wallet", () => ({
  WalletError: class extends Error {
    code = 0;
  },
  walletRequest: (method: string, params: unknown[] = []) =>
    Promise.resolve(wallet.handler(method, params)),
}));

const FROM = "0x02cefD0E0547bb176f508380399A982fAb676A92";
const uint = (v: bigint) => encodeAbiParameters([{ type: "uint256" }], [v]);
let sent: { to: string; data: Hex; value: string }[] = [];
function fakeWallet(state: {
  balance: bigint;
  allowance: bigint;
  out: bigint;
}) {
  sent = [];
  wallet.handler = (method, params) => {
    const tx = params[0] as { to: string; data: Hex; value: string };
    switch (method) {
      case "eth_requestAccounts":
        return [FROM];
      case "eth_chainId":
        return "0x8f";
      case "eth_getBalance":
        return `0x${state.balance.toString(16)}`;
      case "eth_call": {
        const name = tx.data.startsWith("0x70a08231")
          ? "balance"
          : tx.data.startsWith("0xdd62ed3e")
            ? "allowance"
            : "order";
        return uint(
          name === "balance"
            ? state.balance
            : name === "allowance"
              ? state.allowance
              : state.out,
        );
      }
      case "eth_sendTransaction":
        sent.push(tx);
        return `0x${String(sent.length).padStart(64, "0")}`;
      case "eth_getTransactionReceipt":
        return { status: "0x1", logs: [] };
    }
    throw new Error(`unexpected ${method}`);
  };
}

beforeEach(() => vi.resetModules());

describe("directTrade", () => {
  it("sells native MON as value with a simulated minimum, no approval", async () => {
    fakeWallet({ balance: 20n * 10n ** 18n, allowance: 0n, out: 250_000n });
    const { directTrade } = await import("./direct-trade");
    const result = await directTrade({
      market: "MON",
      side: "sell",
      amount: "10",
      slippageBps: 50,
      creator: null,
      onStatus: () => {},
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(kuruMainnet.markets.MON.market);
    expect(BigInt(sent[0]?.value ?? "0")).toBe(10n * 10n ** 18n);
    const call = decodeFunctionData({
      abi: kuruV1OrderBookAbi,
      data: sent[0]?.data as Hex,
    });
    expect(call.functionName).toBe("placeAndExecuteMarketSell");
    // 0.5% below the simulated 0.25 USDC.
    expect(call.args?.[1]).toBe(248_750n);
    expect(result.from).toBe(FROM);
  });

  it("approves exactly the spend before a USDC buy", async () => {
    fakeWallet({ balance: 5_000_000n, allowance: 0n, out: 40n * 10n ** 18n });
    const { directTrade } = await import("./direct-trade");
    await directTrade({
      market: "MON",
      side: "buy",
      amount: "1",
      slippageBps: 50,
      creator: null,
      onStatus: () => {},
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]?.to).toBe(kuruMainnet.quote.address);
    expect(
      decodeFunctionData({ abi: erc20Abi, data: sent[0]?.data as Hex }).args,
    ).toEqual([kuruMainnet.markets.MON.market, 1_000_000n]);
    expect(
      decodeFunctionData({
        abi: kuruV1OrderBookAbi,
        data: sent[1]?.data as Hex,
      }).functionName,
    ).toBe("placeAndExecuteMarketBuy");
  });

  it("refuses when the wallet lacks funds, before sending anything", async () => {
    fakeWallet({ balance: 10n, allowance: 0n, out: 1n });
    const { directTrade } = await import("./direct-trade");
    await expect(
      directTrade({
        market: "MON",
        side: "buy",
        amount: "1",
        slippageBps: 50,
        creator: null,
        onStatus: () => {},
      }),
    ).rejects.toThrow(/Not enough/);
    expect(sent).toHaveLength(0);
  });
});
