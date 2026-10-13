import "server-only";
import { amountSchema } from "@call-my-bluff/domain";
import { flowEntrypoint } from "@call-my-bluff/integrations/creator-fees";
import { createPublicClient, http } from "viem";
import { monad } from "viem/chains";
import { z } from "zod";
import { envioQuery } from "./envio";
import { envioEvidence } from "./envio-evidence";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const payment = z.object({
  id: z.string(),
  chainId: z.literal(143),
  contract: address,
  buyer: address,
  creatorWallet: address,
  token: address,
  amount: amountSchema,
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  blockHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  blockNumber: amountSchema,
  timestamp: amountSchema,
});
const unavailable = () => ({
  status: "unavailable" as const,
  payments: [] as z.infer<typeof payment>[],
  observedAt: new Date().toISOString(),
});

/** Bounded confirmed-payment history; never sum unlike tokens or infer fees from orders. */
async function indexedCreatorEarnings(wallet: string) {
  try {
    const result = await envioQuery(
      `query CreatorEarnings($wallet: String!) {
      _meta(where: {chainId: {_eq: 143}}) {progressBlock progressBlockTime isReady}
      CreatorFeePayment(where: {creatorWallet: {_eq: $wallet}, chainId: {_eq: 143}}, order_by: [{blockNumber: desc}, {id: desc}], limit: 20) {id chainId contract buyer creatorWallet token amount transactionHash blockHash blockNumber timestamp}
    }`,
      { wallet: wallet.toLowerCase() },
    );
    const meta = z
      .object({
        progressBlock: z.union([
          z.string().regex(/^[0-9]+$/),
          z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        ]),
        progressBlockTime: z.iso.datetime(),
        isReady: z.boolean(),
      })
      .safeParse(
        Array.isArray(result?.data?._meta) ? result.data._meta[0] : null,
      );
    const payments = z
      .array(payment)
      .safeParse(result?.data?.CreatorFeePayment);
    if (result?.errors || !meta.success || !payments.success)
      return unavailable();
    const client = createPublicClient({
      chain: monad,
      transport: http(
        process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
        { timeout: 10000, retryCount: 0 },
      ),
    });
    if ((await client.getChainId()) !== 143) return unavailable();
    const head = await client.getBlock();
    const progress = BigInt(meta.data.progressBlock);
    if (
      !head.number ||
      progress > head.number ||
      payments.data.some(
        (p) =>
          p.creatorWallet.toLowerCase() !== wallet.toLowerCase() ||
          p.contract.toLowerCase() !== flowEntrypoint.toLowerCase() ||
          BigInt(p.blockNumber) > progress,
      )
    )
      return unavailable();
    // Verify canonical blocks for displayed payments in addition to Envio rollback protection.
    const hashes = new Map<string, string>();
    for (const p of payments.data) {
      if (!hashes.has(p.blockNumber))
        hashes.set(
          p.blockNumber,
          (await client.getBlock({ blockNumber: BigInt(p.blockNumber) })).hash,
        );
      if (
        hashes.get(p.blockNumber)?.toLowerCase() !== p.blockHash.toLowerCase()
      )
        return unavailable();
    }
    const fresh =
      meta.data.isReady &&
      head.number - progress <= 100n &&
      Date.now() - Date.parse(meta.data.progressBlockTime) <= 60000 &&
      Date.parse(meta.data.progressBlockTime) <= Date.now() + 5000;
    return {
      status: fresh ? ("current" as const) : ("lagging" as const),
      payments: payments.data,
      observedAt: new Date().toISOString(),
      progressBlock: progress.toString(),
      finality: "10-block indexer lag; not a finality guarantee",
    };
  } catch {
    return unavailable();
  }
}

export async function creatorEarnings(wallet: string) {
  if (!address.safeParse(wallet).success) return unavailable();
  const indexed = await indexedCreatorEarnings(wallet);
  if (indexed.status !== "unavailable")
    return { ...indexed, source: "Envio HyperIndex" };
  const evidence = await envioEvidence(143, wallet);
  return {
    status: evidence.status,
    payments: evidence.records
      .filter((e) => e.kind === "payment")
      .map((e) => payment.parse(e)),
    observedAt: evidence.observedAt,
    progressBlock: evidence.progressBlock,
    finality: evidence.finality,
    source: evidence.source,
  };
}
