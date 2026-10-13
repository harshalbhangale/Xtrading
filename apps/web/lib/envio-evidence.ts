import "server-only";
import {
  flowAbi,
  flowEntrypoint,
} from "@call-my-bluff/integrations/creator-fees";
import {
  type EnvioEvent,
  hyperSyncResponse,
  projectEnvioEvents,
} from "@call-my-bluff/integrations/envio-events";
import { createPublicClient, encodeEventTopics, http } from "viem";
import { monad } from "viem/chains";

const configs = {
  143: {
    url: "https://monad.hypersync.xyz/query",
    from: 112914000,
    contract: flowEntrypoint,
    topic: encodeEventTopics({ abi: flowAbi, eventName: "FeeCollected" })[0],
  },
} as const;
const cached = new Map<
  number,
  { at: number; value: Promise<{ events: EnvioEvent[]; progress: number }> }
>();
const TTL = 60_000;
export function clearHyperSyncCache() {
  cached.clear();
}

async function scan(chainId: 143, head: bigint) {
  const hit = cached.get(chainId);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const value = (async () => {
    const token = process.env.ENVIO_API_TOKEN;
    if (!token) throw new Error("hypersync_unconfigured");
    const config = configs[chainId];
    const limit = Number(head - 10n + 1n);
    if (!Number.isSafeInteger(limit) || limit < config.from)
      throw new Error("invalid_chain_head");
    let from: number = config.from,
      target = limit;
    const pages: unknown[] = [];
    let progress = from - 1;
    for (let page = 0; page < 3 && from < target; page++) {
      const response = await fetch(config.url, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          from_block: from,
          to_block: target,
          max_num_logs: 1000,
          logs: [{ address: [config.contract], topics: [[config.topic]] }],
          field_selection: {
            block: ["number", "timestamp", "hash"],
            log: [
              "block_number",
              "log_index",
              "transaction_index",
              "data",
              "address",
              "topic0",
              "topic1",
              "topic2",
              "topic3",
            ],
            transaction: ["block_number", "transaction_index", "hash"],
          },
        }),
      });
      if (!response.ok) throw new Error("hypersync_unavailable");
      const text = await response.text();
      if (text.length > 3_000_000) throw new Error("response_too_large");
      const parsed = hyperSyncResponse.parse(JSON.parse(text));
      target = Math.min(target, parsed.archive_height + 1);
      if (
        parsed.next_block <= from ||
        parsed.next_block > limit ||
        parsed.data.some((b) =>
          b.logs.some(
            (l) => l.block_number < from || l.block_number >= parsed.next_block,
          ),
        )
      )
        throw new Error("invalid_scan_progress");
      pages.push(parsed);
      from = parsed.next_block;
      progress = from - 1;
    }
    if (from < target) throw new Error("scan_incomplete");
    const events = pages.flatMap((p) => projectEnvioEvents(chainId, p));
    const unique = new Map<string, EnvioEvent>();
    for (const event of events) {
      const prior = unique.get(event.id);
      if (prior && JSON.stringify(prior) !== JSON.stringify(event))
        throw new Error("conflicting_event");
      unique.set(event.id, event);
    }
    return { events: [...unique.values()], progress };
  })();
  cached.set(chainId, { at: Date.now(), value });
  return value;
}

/** Envio discovers events; independent receipt/block checks reject orphaned or altered evidence. */
export async function envioEvidence(chainId: 143, wallet?: string) {
  const unavailable = {
    status: "unavailable" as const,
    source: "Envio HyperSync" as const,
    chainId,
    fromBlock: String(configs[chainId].from),
    observedAt: new Date().toISOString(),
    records: [] as EnvioEvent[],
    progressBlock: null as string | null,
    finality: "10-block read lag; not a finality guarantee",
  };
  try {
    const client = createPublicClient({
      chain: monad,
      transport: http(
        process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
        { timeout: 10000, retryCount: 0 },
      ),
    });
    if ((await client.getChainId()) !== chainId) return unavailable;
    const head = await client.getBlock();
    const result = await scan(chainId, head.number);
    if (BigInt(result.progress) > head.number - 10n) return unavailable;
    const records = result.events
      .filter((e) => !wallet || e.creatorWallet === wallet.toLowerCase())
      .sort(
        (a, b) =>
          Number(BigInt(b.blockNumber) - BigInt(a.blockNumber)) ||
          b.logIndex - a.logIndex,
      )
      .slice(0, 20);
    for (let i = 0; i < records.length; i += 4)
      await Promise.all(
        records.slice(i, i + 4).map(async (e) => {
          const [block, receipt] = await Promise.all([
            client.getBlock({ blockNumber: BigInt(e.blockNumber) }),
            client.getTransactionReceipt({
              hash: e.transactionHash as `0x${string}`,
            }),
          ]);
          const log = receipt.logs.find((l) => l.logIndex === e.logIndex);
          if (
            block.hash.toLowerCase() !== e.blockHash ||
            block.timestamp.toString() !== e.timestamp ||
            receipt.blockHash.toLowerCase() !== e.blockHash ||
            receipt.status !== "success" ||
            !log ||
            log.address.toLowerCase() !== e.contract ||
            log.data.toLowerCase() !== e.rawData.toLowerCase() ||
            JSON.stringify(log.topics.map((t) => t.toLowerCase())) !==
              JSON.stringify(e.topics.map((t) => t.toLowerCase()))
          )
            throw new Error("noncanonical_evidence");
        }),
      );
    const block = await client.getBlock({
      blockNumber: BigInt(result.progress),
    });
    const current =
      head.number - BigInt(result.progress) <= 100n &&
      head.timestamp - block.timestamp <= 60n;
    return {
      ...unavailable,
      status: current ? ("current" as const) : ("lagging" as const),
      records,
      progressBlock: String(result.progress),
    };
  } catch {
    return unavailable;
  }
}
