import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import { flowEntrypoint } from "@call-my-bluff/integrations/creator-fees";
import {
  type KuruMarketKey,
  kuruMainnet,
  kuruMarketKeys,
  kuruV2,
  MAINNET_PRICE_SCALE,
  mainnetFillsFromLogs,
  orderBookAbi,
} from "@call-my-bluff/integrations/kuru";
import { decodeEventLog, getAddress, type Hex } from "viem";
import { z } from "zod";
import { kuruMainnetSnapshot, kuruMarketSnapshot } from "./markets";

const hypersync = {
  10143: "https://monad-testnet.hypersync.xyz/query",
  143: "https://monad.hypersync.xyz/query",
} as const;
const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);
const integer = z.number().int().nonnegative();
const pageSchema = z.object({
  next_block: integer,
  archive_height: integer.nullable().optional(),
  data: z.array(
    z.object({
      blocks: z.array(z.object({ number: integer, timestamp: hex })).optional(),
      transactions: z
        .array(
          z.object({
            hash: hex,
            block_number: integer,
            status: z.number().int().nullable(),
          }),
        )
        .optional(),
      logs: z
        .array(
          z.object({
            transaction_hash: hex,
            log_index: integer,
            address: hex,
            data: hex,
            topic0: hex.nullable(),
            topic1: hex.nullable().optional(),
            topic2: hex.nullable().optional(),
            topic3: hex.nullable().optional(),
          }),
        )
        .optional(),
    }),
  ),
});
type Part = z.infer<typeof pageSchema>["data"][number];
type RawLog = NonNullable<Part["logs"]>[number];

/** The wallet's own transactions to the configured Kuru contracts, with their logs. */
async function scan(wallet: string, chainId: 10143 | 143) {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) throw new IdentityError("history_unconfigured", 503);
  const targets =
    chainId === 143
      ? [
          ...Object.values(kuruMainnet.markets).map((m) => m.market),
          flowEntrypoint,
        ]
      : Object.values(kuruV2.markets).map((m) => m.market);
  const out: Required<Part> = { blocks: [], transactions: [], logs: [] };
  let from = 0;
  for (let page = 0; page < 8; page++) {
    const response = await fetch(hypersync[chainId], {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from_block: from,
        join_mode: "JoinAll",
        max_num_transactions: 500,
        transactions: [
          {
            from: [wallet.toLowerCase()],
            to: targets.map((t) => t.toLowerCase()),
          },
        ],
        field_selection: {
          block: ["number", "timestamp"],
          transaction: ["hash", "block_number", "status"],
          log: [
            "transaction_hash",
            "log_index",
            "address",
            "data",
            "topic0",
            "topic1",
            "topic2",
            "topic3",
          ],
        },
      }),
    }).catch(() => null);
    if (!response?.ok) throw new IdentityError("history_unavailable", 503);
    const text = await response.text();
    if (text.length > 6_000_000)
      throw new IdentityError("history_too_large", 503);
    const parsed = pageSchema.parse(JSON.parse(text));
    for (const part of parsed.data) {
      out.blocks.push(...(part.blocks ?? []));
      out.transactions.push(...(part.transactions ?? []));
      out.logs.push(...(part.logs ?? []));
    }
    const height = parsed.archive_height ?? parsed.next_block;
    if (parsed.next_block <= from || parsed.next_block >= height) break;
    from = parsed.next_block;
  }
  return out;
}

const topics = (log: RawLog) =>
  [log.topic0, log.topic1, log.topic2, log.topic3].filter(
    (t): t is string => typeof t === "string" && t.length === 66,
  ) as [Hex, ...Hex[]];

/** Base and quote moved by one confirmed transaction, per market, for this wallet. */
function fillsOf(
  chainId: 10143 | 143,
  wallet: `0x${string}`,
  logs: RawLog[],
): { key: KuruMarketKey; side: "buy" | "sell"; base: bigint; quote: bigint }[] {
  if (chainId === 143)
    return kuruMarketKeys.flatMap((key) => {
      const fill = mainnetFillsFromLogs({
        key,
        wallet,
        logs: logs.map((l) => ({
          address: getAddress(l.address),
          data: l.data as Hex,
          topics: topics(l),
        })),
      });
      return fill
        ? [
            {
              key,
              side: fill.side,
              base: fill.baseAmount,
              quote: fill.quoteAmount,
            },
          ]
        : [];
    });
  const found: ReturnType<typeof fillsOf> = [];
  for (const key of kuruMarketKeys) {
    const market = kuruV2.markets[key].market.toLowerCase();
    for (const log of logs) {
      if (log.address.toLowerCase() !== market) continue;
      try {
        const event = decodeEventLog({
          abi: orderBookAbi,
          data: log.data as Hex,
          topics: topics(log),
        });
        if (event.eventName !== "SpotSwap") continue;
        if (event.args.executor.toLowerCase() !== wallet.toLowerCase())
          continue;
        const { isBuy, amountInUsed, amountOut } = event.args;
        found.push({
          key,
          side: isBuy ? "buy" : "sell",
          base: isBuy ? amountOut : amountInUsed,
          quote: isBuy ? amountInUsed : amountOut,
        });
      } catch {}
    }
  }
  return found;
}

/** Current mid price as 6-decimal USDC per one whole base token, or null. */
async function midPrice(chainId: 10143 | 143, key: KuruMarketKey) {
  try {
    if (chainId === 143) {
      const { bid, ask } = await kuruMainnetSnapshot(key);
      if (bid === 0n || ask === 0n) return null;
      return (((bid + ask) / 2n) * 10n ** 6n) / MAINNET_PRICE_SCALE;
    }
    const { state } = await kuruMarketSnapshot(key);
    if (!state.bestBid || !state.bestAsk) return null;
    const mid = (BigInt(state.bestBid) + BigInt(state.bestAsk)) / 2n;
    return (mid * 10n ** 6n) / kuruV2.markets[key].pricePrecision;
  } catch {
    return null;
  }
}

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

/**
 * Kuru spot trade history and PnL for one wallet on one network, from chain:
 * fills are decoded from the wallet's own transactions to the configured order
 * books (and Kuru Flow on mainnet). PnL uses average cost of the bought tokens
 * and the current book midpoint; tokens bought elsewhere are not counted.
 */
export async function spotHistory(input: { wallet: string; chainId: number }) {
  if (input.chainId !== 10143 && input.chainId !== 143)
    throw new IdentityError("unsupported_chain", 409);
  const chainId = input.chainId;
  const wallet = getAddress(input.wallet);
  const key = `${chainId}:${wallet}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;
  const value = build(wallet, chainId);
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

async function build(wallet: `0x${string}`, chainId: 10143 | 143) {
  const network = chainId === 143 ? kuruMainnet : kuruV2;
  const scanned = await scan(wallet, chainId);
  const times = new Map(
    scanned.blocks.map((b) => [b.number, Number(BigInt(b.timestamp))]),
  );
  const logsByTx = new Map<string, RawLog[]>();
  for (const log of scanned.logs) {
    const list = logsByTx.get(log.transaction_hash) ?? [];
    list.push(log);
    logsByTx.set(log.transaction_hash, list);
  }
  const seen = new Set<string>();
  const txs = [...scanned.transactions]
    .filter((t) => t.status === 1 && !seen.has(t.hash) && seen.add(t.hash))
    .sort((a, b) => a.block_number - b.block_number);

  // Average cost per market, in USDC atoms, of tokens bought through these trades.
  const held = new Map<KuruMarketKey, { base: bigint; cost: bigint }>();
  let realized = 0n;
  const history: {
    transactionHash: string;
    block: number;
    time: string | null;
    market: KuruMarketKey;
    symbol: string;
    baseDecimals: number;
    side: "buy" | "sell";
    baseAmount: string;
    quoteAmount: string;
    price: string | null;
    realizedPnl: string | null;
  }[] = [];
  for (const tx of txs) {
    const timestamp = times.get(tx.block_number);
    for (const fill of fillsOf(chainId, wallet, logsByTx.get(tx.hash) ?? [])) {
      const base = network.markets[fill.key].base;
      const scale = 10n ** BigInt(base.decimals);
      const position = held.get(fill.key) ?? { base: 0n, cost: 0n };
      let pnl: bigint | null = null;
      if (fill.side === "buy")
        held.set(fill.key, {
          base: position.base + fill.base,
          cost: position.cost + fill.quote,
        });
      else if (position.base > 0n) {
        const sold = fill.base < position.base ? fill.base : position.base;
        const basis = (position.cost * sold) / position.base;
        // Proceeds for the part that was bought here; the rest has no known cost.
        const proceeds = (fill.quote * sold) / fill.base;
        pnl = proceeds - basis;
        realized += pnl;
        held.set(fill.key, {
          base: position.base - sold,
          cost: position.cost - basis,
        });
      }
      history.push({
        transactionHash: tx.hash,
        block: tx.block_number,
        time: timestamp ? new Date(timestamp * 1000).toISOString() : null,
        market: fill.key,
        symbol: base.symbol,
        baseDecimals: base.decimals,
        side: fill.side,
        baseAmount: fill.base.toString(),
        quoteAmount: fill.quote.toString(),
        price:
          fill.base > 0n ? ((fill.quote * scale) / fill.base).toString() : null,
        realizedPnl: pnl?.toString() ?? null,
      });
    }
  }

  // One market at a time: the public RPC rate-limits parallel reads.
  const mids = new Map<KuruMarketKey, bigint | null>();
  for (const [key, h] of held)
    if (h.base > 0n) mids.set(key, await midPrice(chainId, key));
  const holdings = (
    await Promise.all(
      [...held.entries()]
        .filter(([, h]) => h.base > 0n)
        .map(async ([key, h]) => {
          const base = network.markets[key].base;
          const mid = mids.get(key) ?? null;
          const scale = 10n ** BigInt(base.decimals);
          const value = mid === null ? null : (h.base * mid) / scale;
          return {
            market: key,
            symbol: base.symbol,
            baseDecimals: base.decimals,
            amount: h.base.toString(),
            averageCost: ((h.cost * scale) / h.base).toString(),
            costBasis: h.cost.toString(),
            markPrice: mid?.toString() ?? null,
            value: value?.toString() ?? null,
            unrealizedPnl: value === null ? null : (value - h.cost).toString(),
          };
        }),
    )
  ).filter((h) => BigInt(h.amount) > 0n);
  const unrealized = holdings.reduce(
    (s, h) => s + (h.unrealizedPnl ? BigInt(h.unrealizedPnl) : 0n),
    0n,
  );
  return {
    wallet,
    network: chainId === 143 ? "mainnet" : "testnet",
    chainId,
    explorer:
      chainId === 143
        ? "https://monadvision.com"
        : "https://testnet.monadvision.com",
    quoteSymbol: "USDC",
    quoteDecimals: 6,
    summary: {
      realizedPnl: realized.toString(),
      unrealizedPnl: unrealized.toString(),
      netPnl: (realized + unrealized).toString(),
      trades: history.length,
    },
    holdings,
    history: history.reverse(),
    method:
      chainId === 143
        ? "Fills from your wallet's transactions to Kuru's mainnet order books and Kuru Flow (Envio HyperSync), decoded from Kuru's Trade events. PnL uses average cost and the current book midpoint; tokens bought elsewhere are not counted."
        : "Swaps from your wallet's transactions to Kuru's testnet order books (Envio HyperSync), decoded from SpotSwap events. PnL uses average cost and the current book midpoint; test tokens have no value.",
    observedAt: new Date().toISOString(),
  };
}
