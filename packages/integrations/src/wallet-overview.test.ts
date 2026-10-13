import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/web/node_modules/server-only/index.js", () => ({}));
const f = vi.hoisted(() => ({
  getChainId: vi.fn(),
  getBlock: vi.fn(),
  getBalance: vi.fn(),
  readContract: vi.fn(),
  getTransactionReceipt: vi.fn(),
}));
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return { ...actual, createPublicClient: () => f };
});

import {
  clearWalletHistoryCache,
  walletOverview,
} from "../../../apps/web/lib/wallet-overview";

const wallet = `0x${"11".repeat(20)}`;
const hash = `0x${"22".repeat(32)}`;
const blockHash = `0x${"33".repeat(32)}`;
const history = {
  next_block: 191,
  archive_height: 200,
  data: [
    {
      blocks: [{ number: 100, hash: blockHash, timestamp: "0x64" }],
      transactions: [
        {
          hash,
          block_number: 100,
          from: wallet,
          to: `0x${"44".repeat(20)}`,
          value: "0x0",
          status: 1,
        },
      ],
    },
  ],
};
beforeEach(() => {
  clearWalletHistoryCache();
  vi.stubEnv("ENVIO_API_TOKEN", "test-only");
  f.getChainId.mockResolvedValue(143);
  f.getBlock.mockImplementation(async (input) => ({
    number: input?.blockNumber ?? 200n,
    hash: blockHash,
    timestamp: 100n,
  }));
  f.getBalance.mockResolvedValue(2000000000000000000n);
  f.readContract.mockResolvedValue(1000000n);
  f.getTransactionReceipt.mockResolvedValue({
    blockHash,
    from: wallet,
    to: `0x${"44".repeat(20)}`,
    status: "success",
    logs: [],
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(history))),
  );
});
describe("Wallet portfolio evidence", () => {
  it("keeps balances available when history fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );
    const r = await walletOverview(wallet);
    expect(r.balances[0]?.amount).toBe("2000000000000000000");
    expect(r.historyStatus).toBe("unavailable");
    expect(r.transactions).toEqual([]);
  });
  it("shows receipt-checked direct wallet history", async () => {
    const r = await walletOverview(wallet);
    expect(r.historyStatus).toBe("current");
    expect(r.transactions[0]).toMatchObject({
      hash,
      status: "success",
      value: "0",
    });
  });
  it("rejects orphaned history without hiding balances", async () => {
    f.getTransactionReceipt.mockResolvedValue({
      blockHash: `0x${"55".repeat(32)}`,
      from: wallet,
      to: `0x${"44".repeat(20)}`,
      status: "success",
      logs: [],
    });
    const r = await walletOverview(wallet);
    expect(r.historyStatus).toBe("unavailable");
    expect(r.balances).toHaveLength(4);
  });
  it("rejects unrelated wallet transactions", async () => {
    const other = structuredClone(history);
    const tx = other.data[0]?.transactions[0];
    if (!tx) throw new Error("missing fixture");
    tx.from = `0x${"66".repeat(20)}`;
    f.getTransactionReceipt.mockResolvedValue({
      blockHash,
      from: other.data[0]?.transactions[0]?.from,
      to: `0x${"44".repeat(20)}`,
      status: "success",
      logs: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(other))),
    );
    expect((await walletOverview(wallet)).historyStatus).toBe("unavailable");
  });
  it("rejects an unsupported chain", async () => {
    f.getChainId.mockResolvedValue(10143);
    await expect(walletOverview(wallet)).rejects.toThrow("wrong_chain");
  });
});
