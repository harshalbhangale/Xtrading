import "server-only";
import { kuruMainnet } from "@call-my-bluff/integrations/kuru";
import { createPublicClient, decodeEventLog, erc20Abi, http } from "viem";
import { monad } from "viem/chains";
import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const units = z.string().regex(/^(0x[0-9a-fA-F]+|[0-9]+)$/);
const responseSchema = z.object({
  next_block: integer,
  archive_height: integer,
  data: z
    .array(
      z.object({
        blocks: z.array(z.object({ number: integer, hash, timestamp: units })),
        transactions: z.array(
          z.object({
            hash,
            block_number: integer,
            from: address,
            to: address.nullable(),
            value: units,
            status: z.number().int().min(0).max(1),
          }),
        ),
      }),
    )
    .max(1000),
});
const tokens = [
  kuruMainnet.quote,
  kuruMainnet.markets.WETH.base,
  kuruMainnet.markets.WBTC.base,
];
const transferTopic =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const cache = new Map<
  string,
  { at: number; value: Promise<z.infer<typeof responseSchema>> }
>();
export function clearWalletHistoryCache() {
  cache.clear();
}
async function history(wallet: string, head: bigint) {
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < 60000) return hit.value;
  const value = (async () => {
    if (!process.env.ENVIO_API_TOKEN) throw new Error("unconfigured");
    const end = Number(head - 10n + 1n);
    const r = await fetch("https://monad.hypersync.xyz/query", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.ENVIO_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_block: Math.max(0, end - 100000),
        to_block: end,
        max_num_transactions: 1000,
        transactions: [{ from: [wallet] }, { to: [wallet] }],
        logs: [
          {
            address: tokens.map((t) => t.address),
            topics: [
              [transferTopic],
              [`0x${wallet.slice(2).padStart(64, "0")}`],
            ],
          },
          {
            address: tokens.map((t) => t.address),
            topics: [
              [transferTopic],
              [],
              [`0x${wallet.slice(2).padStart(64, "0")}`],
            ],
          },
        ],
        field_selection: {
          block: ["number", "hash", "timestamp"],
          transaction: [
            "hash",
            "block_number",
            "from",
            "to",
            "value",
            "status",
          ],
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error("history_unavailable");
    const text = await r.text();
    if (text.length > 3000000) throw new Error("history_too_large");
    return responseSchema.parse(JSON.parse(text));
  })();
  if (cache.size >= 100) cache.clear();
  cache.set(wallet, { at: Date.now(), value });
  return value;
}
export async function walletOverview(input: string) {
  const wallet = address.parse(input).toLowerCase() as `0x${string}`;
  const c = createPublicClient({
    chain: monad,
    transport: http(
      process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
      { timeout: 10000, retryCount: 0 },
    ),
  });
  if ((await c.getChainId()) !== 143) throw new Error("wrong_chain");
  const head = await c.getBlock();
  const balances = await Promise.all([
    c
      .getBalance({ address: wallet })
      .then((n) => ({ symbol: "MON", decimals: 18, amount: n.toString() })),
    ...tokens.map(async (t) => ({
      symbol: t.symbol,
      decimals: t.decimals,
      amount: (
        await c.readContract({
          address: t.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [wallet],
        })
      ).toString(),
    })),
  ]);
  const base = {
    wallet,
    chainId: 143,
    balances,
    observedAt: new Date().toISOString(),
  };
  try {
    const data = await history(wallet, head.number);
    const last = Number(head.number - 10n + 1n);
    if (
      data.next_block <= 0 ||
      data.next_block > last ||
      data.data.some((batch) =>
        batch.transactions.some(
          (tx) =>
            tx.block_number < Math.max(0, last - 100000 - 1000) ||
            tx.block_number >= data.next_block,
        ),
      )
    )
      throw new Error("invalid_history_window");
    const blocks = new Map(
      data.data.flatMap((b) => b.blocks).map((b) => [b.number, b]),
    );
    const unique = new Map<
      string,
      z.infer<typeof responseSchema>["data"][number]["transactions"][number]
    >();
    for (const t of data.data.flatMap((b) => b.transactions)) {
      const previous = unique.get(t.hash);
      if (previous && JSON.stringify(previous) !== JSON.stringify(t))
        throw new Error("conflicting_transaction");
      unique.set(t.hash, t);
    }
    const entries = [...unique.values()]
      .sort((a, b) => b.block_number - a.block_number)
      .slice(0, 20);
    const transactions = [];
    for (let i = 0; i < entries.length; i += 4) {
      const batch = await Promise.all(
        entries.slice(i, i + 4).map(async (t) => {
          const b = blocks.get(t.block_number);
          if (!b || BigInt(t.block_number) > head.number - 10n)
            throw new Error("missing_block");
          const receipt = await c.getTransactionReceipt({
            hash: t.hash as `0x${string}`,
          });
          const block = await c.getBlock({
            blockNumber: BigInt(t.block_number),
          });
          if (
            receipt.blockHash.toLowerCase() !== b.hash.toLowerCase() ||
            block.hash.toLowerCase() !== b.hash.toLowerCase() ||
            block.timestamp !== BigInt(b.timestamp) ||
            receipt.from.toLowerCase() !== t.from.toLowerCase() ||
            receipt.to?.toLowerCase() !== t.to?.toLowerCase() ||
            (receipt.status === "success" ? 1 : 0) !== t.status
          )
            throw new Error("noncanonical_history");
          const transfers = [];
          for (const log of receipt.logs) {
            const token = tokens.find(
              (token) =>
                token.address.toLowerCase() === log.address.toLowerCase(),
            );
            if (!token) continue;
            try {
              const event = decodeEventLog({
                abi: erc20Abi,
                eventName: "Transfer",
                data: log.data,
                topics: log.topics,
              });
              if (
                event.args.from.toLowerCase() === wallet ||
                event.args.to.toLowerCase() === wallet
              )
                transfers.push({
                  id: `${t.hash}:${log.logIndex}`,
                  symbol: token.symbol,
                  decimals: token.decimals,
                  amount: event.args.value.toString(),
                  direction:
                    event.args.from.toLowerCase() === wallet ? "out" : "in",
                });
            } catch {}
          }
          if (
            t.from.toLowerCase() !== wallet &&
            t.to?.toLowerCase() !== wallet &&
            transfers.length === 0
          )
            throw new Error("wrong_wallet");
          const book = Object.values(kuruMainnet.markets).some(
            (m) => m.market.toLowerCase() === t.to?.toLowerCase(),
          );
          return {
            hash: t.hash,
            status: receipt.status,
            time: new Date(Number(block.timestamp) * 1000).toISOString(),
            from: t.from,
            to: t.to,
            value:
              receipt.status === "success" ? BigInt(t.value).toString() : "0",
            nativeDirection: t.from.toLowerCase() === wallet ? "out" : "in",
            label: book
              ? "Kuru trade"
              : t.to?.toLowerCase() === kuruMainnet.quote.address.toLowerCase()
                ? "USDC contract"
                : BigInt(t.value) > 0n
                  ? "MON transfer"
                  : "Contract interaction",
            transfers,
          };
        }),
      );
      transactions.push(...batch);
    }
    const lag = head.number - BigInt(data.next_block - 1);
    return {
      ...base,
      historyStatus: lag <= 100n ? "current" : "partial",
      transactions,
      windowBlocks: 100000,
      historySource: "Envio HyperSync · receipt checked",
    };
  } catch {
    return {
      ...base,
      historyStatus: "unavailable",
      transactions: [],
      windowBlocks: 100000,
      historySource: "Envio HyperSync",
    };
  }
}
