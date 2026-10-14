import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  type PerplNetwork,
  perplExchangeAbi,
  perplOrderAction,
  perplOrderOutcome,
} from "@call-my-bluff/integrations/perpl-exchange";
import { decodeFunctionData, getAddress, type Hex, type Log } from "viem";
import { z } from "zod";
import { perplSnapshot } from "./markets";
import { exchangeAccount, network, openPosition } from "./perpl-trade";

const hypersync: Record<number, string> = {
  10143: "https://monad-testnet.hypersync.xyz/query",
  143: "https://monad.hypersync.xyz/query",
};
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
            input: hex,
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
type Page = z.infer<typeof pageSchema>["data"][number];

/** Every transaction the wallet sent to Perpl's exchange, with its own logs (Envio HyperSync). */
async function scan(wallet: string, selected: PerplNetwork) {
  const token = process.env.ENVIO_API_TOKEN;
  if (!token) throw new IdentityError("history_unconfigured", 503);
  const url = hypersync[selected.chainId];
  if (!url) throw new IdentityError("unsupported_chain", 409);
  const out: Required<Page> = { blocks: [], transactions: [], logs: [] };
  let from = 0;
  for (let page = 0; page < 8; page++) {
    const response = await fetch(url, {
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
            to: [selected.exchange.toLowerCase()],
          },
        ],
        field_selection: {
          block: ["number", "timestamp"],
          transaction: ["hash", "block_number", "status", "input"],
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

const cache = new Map<string, { at: number; value: Promise<unknown> }>();

type Fill = {
  transactionHash: string;
  block: number;
  time: string | null;
  kind: "order" | "deposit" | "withdraw" | "account";
  action: (typeof perplOrderAction)[number] | null;
  marketId: number | null;
  symbol: string | null;
  priceDecimals: number | null;
  sizeDecimals: number | null;
  leverage: number | null;
  requestedSize: string | null;
  filledSize: string;
  averagePrice: string | null;
  fee: string;
  amount: string | null;
  realizedPnl: string | null;
  status: "filled" | "partially-filled" | "not-filled" | "reverted" | "done";
};

/**
 * Perpl trade history and PnL for one wallet on one network, from the chain:
 * orders and their fills come from the wallet's own transactions to the
 * exchange; open positions and mark prices from the exchange contract.
 * Realized PnL is estimated from those fills at average entry, before funding.
 */
export async function perpHistory(input: { wallet: string; chainId: number }) {
  const selected = network(input.chainId);
  const wallet = getAddress(input.wallet);
  const key = `${selected.chainId}:${wallet}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 20_000) return hit.value;
  const value = build(wallet, selected);
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

async function build(wallet: `0x${string}`, selected: PerplNetwork) {
  const [scanned, account, snapshot] = await Promise.all([
    scan(wallet, selected),
    exchangeAccount(wallet, selected),
    perplSnapshot(selected),
  ]).catch((error) => {
    if (error instanceof IdentityError) throw error;
    throw new IdentityError("perpl_unavailable", 503);
  });
  const markets = new Map(snapshot.markets.map((m) => [m.marketId, m]));
  const times = new Map(
    scanned.blocks.map((b) => [b.number, Number(BigInt(b.timestamp))]),
  );
  const logsByTx = new Map<string, Log[]>();
  for (const log of scanned.logs) {
    const topics = [log.topic0, log.topic1, log.topic2, log.topic3].filter(
      (t): t is string => typeof t === "string" && t.length === 66,
    ) as Hex[];
    const list = logsByTx.get(log.transaction_hash) ?? [];
    list.push({
      address: getAddress(log.address),
      data: log.data as Hex,
      topics: topics as [Hex, ...Hex[]],
      logIndex: log.log_index,
    } as unknown as Log);
    logsByTx.set(log.transaction_hash, list);
  }
  for (const list of logsByTx.values())
    list.sort((a, b) => Number(a.logIndex) - Number(b.logIndex));

  const scale = 10n ** BigInt(selected.collateralDecimals);
  // Running average entry per market, to estimate realized PnL on closes.
  const book = new Map<number, { lots: bigint; avg: bigint; side: number }>();
  const realizedByMarket = new Map<number, bigint>();
  let realized = 0n;
  let fees = 0n;
  const fills: Fill[] = [];
  const seen = new Set<string>();
  const txs = [...scanned.transactions]
    .filter((t) => !seen.has(t.hash) && seen.add(t.hash))
    .sort((a, b) => a.block_number - b.block_number);
  for (const tx of txs) {
    const timestamp = times.get(tx.block_number);
    const base = {
      transactionHash: tx.hash,
      block: tx.block_number,
      time: timestamp ? new Date(timestamp * 1000).toISOString() : null,
    };
    let call: ReturnType<typeof decodeFunctionData<typeof perplExchangeAbi>>;
    try {
      call = decodeFunctionData({
        abi: perplExchangeAbi,
        data: tx.input as Hex,
      });
    } catch {
      continue;
    }
    const empty = {
      action: null,
      marketId: null,
      symbol: null,
      priceDecimals: null,
      sizeDecimals: null,
      leverage: null,
      requestedSize: null,
      filledSize: "0",
      averagePrice: null,
      fee: "0",
      realizedPnl: null,
    };
    if (call.functionName !== "execOrder") {
      const kind =
        call.functionName === "withdrawCollateral"
          ? "withdraw"
          : call.functionName === "depositCollateral"
            ? "deposit"
            : call.functionName === "createAccount"
              ? "account"
              : null;
      if (!kind) continue;
      const amount = call.args?.[0];
      fills.push({
        ...base,
        ...empty,
        kind,
        amount: typeof amount === "bigint" ? amount.toString() : null,
        status: tx.status === 1 ? "done" : "reverted",
      });
      continue;
    }
    const desc = call.args[0];
    const marketId = Number(desc.perpId);
    const market = markets.get(marketId);
    const action = perplOrderAction[desc.orderType] ?? null;
    const outcome =
      tx.status === 1 && account
        ? perplOrderOutcome({
            logs: logsByTx.get(tx.hash) ?? [],
            accountId: account.id,
            orderDescId: desc.orderDescId,
            network: selected,
          })
        : null;
    const lots = outcome?.filledLots ?? 0n;
    const price = outcome?.averagePricePNS ?? null;
    let pnl: bigint | null = null;
    if (market && lots > 0n && price !== null && action) {
      const unit = 10n ** BigInt(market.priceDecimals + market.sizeDecimals);
      const side = action.endsWith("long") ? 1 : -1;
      const held = book.get(marketId) ?? { lots: 0n, avg: 0n, side };
      if (action.startsWith("open")) {
        const total = held.lots + lots;
        const avg =
          held.lots === 0n
            ? price
            : (held.avg * held.lots + price * lots) / total;
        book.set(marketId, { lots: total, avg, side });
      } else if (held.lots > 0n) {
        const closed = lots < held.lots ? lots : held.lots;
        const diff = side === 1 ? price - held.avg : held.avg - price;
        pnl = (diff * closed * scale) / unit;
        realized += pnl;
        realizedByMarket.set(
          marketId,
          (realizedByMarket.get(marketId) ?? 0n) + pnl,
        );
        book.set(marketId, { ...held, lots: held.lots - closed });
      }
    }
    fees += outcome?.feeCNS ?? 0n;
    fills.push({
      ...base,
      kind: "order",
      action,
      marketId,
      symbol: market?.symbol ?? `#${marketId}`,
      priceDecimals: market?.priceDecimals ?? null,
      sizeDecimals: market?.sizeDecimals ?? null,
      leverage: Number(desc.leverageHdths) / 100,
      requestedSize: desc.lotLNS.toString(),
      filledSize: lots.toString(),
      averagePrice: price?.toString() ?? null,
      fee: (outcome?.feeCNS ?? 0n).toString(),
      amount: null,
      realizedPnl: pnl?.toString() ?? null,
      status:
        tx.status !== 1
          ? "reverted"
          : lots === 0n
            ? "not-filled"
            : lots < desc.lotLNS
              ? "partially-filled"
              : "filled",
    });
  }

  const positions = account
    ? (
        await Promise.all(
          snapshot.markets.map(async (market) => ({
            market,
            position: await openPosition(selected, market.marketId, account.id),
          })),
        )
      ).flatMap(({ market, position }) => {
        if (!position) return [];
        const unit = 10n ** BigInt(market.priceDecimals + market.sizeDecimals);
        const diff =
          position.side === "long"
            ? position.markPNS - position.entryPNS
            : position.entryPNS - position.markPNS;
        return [
          {
            marketId: market.marketId,
            symbol: market.symbol,
            priceDecimals: market.priceDecimals,
            sizeDecimals: market.sizeDecimals,
            side: position.side,
            size: position.lots.toString(),
            entryPrice: position.entryPNS.toString(),
            markPrice: position.markPNS.toString(),
            margin: position.depositCNS.toString(),
            unrealizedPnl: ((diff * position.lots * scale) / unit).toString(),
          },
        ];
      })
    : [];
  const unrealized = positions.reduce(
    (s, p) => s + BigInt(p.unrealizedPnl),
    0n,
  );
  return {
    wallet,
    network: selected.network,
    chainId: selected.chainId,
    explorer: selected.explorer,
    collateralSymbol: "AUSD",
    collateralDecimals: selected.collateralDecimals,
    account: account
      ? {
          id: account.id.toString(),
          available: account.balanceCNS.toString(),
          locked: account.lockedCNS.toString(),
        }
      : null,
    summary: {
      realizedPnl: realized.toString(),
      unrealizedPnl: unrealized.toString(),
      fees: fees.toString(),
      netPnl: (realized + unrealized - fees).toString(),
      trades: fills.filter((f) => f.kind === "order" && f.filledSize !== "0")
        .length,
    },
    positions,
    history: fills.reverse(),
    method:
      "Orders and fills from your wallet's transactions to Perpl's exchange (Envio HyperSync), decoded from their events. Positions and marks from the exchange contract. Realized PnL is estimated at average entry and excludes funding.",
    observedAt: new Date().toISOString(),
  };
}
