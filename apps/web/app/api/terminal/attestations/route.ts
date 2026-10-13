import { envioEvidence } from "../../../../lib/envio-evidence";
import { reply } from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const explorers = {
  143: "https://monadvision.com/tx/",
  10143: "https://testnet.monadvision.com/tx/",
} as const;

/**
 * Receipt-checked on-chain attestations for the live terminal: Chainlink CRE
 * call settlements (testnet) and Kuru Flow creator payments (mainnet), both
 * discovered through Envio HyperSync.
 */
export async function GET(request: Request) {
  if (!allow(`attest:${clientKey(request)}`, 10))
    return reply({ error: "rate_limited" }, 429);
  const views = await Promise.all([envioEvidence(10143), envioEvidence(143)]);
  const items = views
    .flatMap((view) =>
      view.records.map((record) => ({
        id: record.id,
        kind: record.kind,
        chainId: record.chainId,
        network: record.chainId === 143 ? "mainnet" : "testnet",
        creatorWallet: record.creatorWallet,
        transactionHash: record.transactionHash,
        blockNumber: record.blockNumber,
        timestamp: Number(record.timestamp) * 1000,
        url: `${explorers[record.chainId]}${record.transactionHash}`,
        detail:
          record.kind === "settlement"
            ? { outcome: record.outcome, callId: record.callId }
            : { amount: record.amount, token: record.token },
      })),
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);
  return reply({
    items,
    sources: views.map((v) => ({
      chainId: v.chainId,
      status: v.status,
      progressBlock: v.progressBlock,
      observedAt: v.observedAt,
    })),
  });
}
