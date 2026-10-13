import { formatUnits, zeroAddress } from "viem";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { envioEvidence } from "../../../lib/envio-evidence";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function OnchainPage() {
  const views = await Promise.all([envioEvidence(143), envioEvidence(10143)]);
  return (
    <>
      <PageHeading
        eyebrow="Envio"
        title="Onchain evidence"
        description="Real creator payments and call scorecard results discovered through Envio HyperSync and checked against chain receipts. No wallet connection needed."
      />
      {views.map((view) => (
        <Panel
          key={view.chainId}
          title={
            view.chainId === 143
              ? "Creator payments · Monad mainnet"
              : "Call scorecard · Monad testnet"
          }
          description={`${view.source} · ${view.status} · Indexed through block ${view.progressBlock || "unavailable"}`}
        >
          <p>
            Checked {view.observedAt}. {view.finality}.
          </p>
          {view.records.length === 0 ? (
            <p>
              {view.status === "unavailable"
                ? "The data source is unavailable. No evidence is inferred."
                : "No matching events found in the configured contract history."}
            </p>
          ) : (
            view.records.map((record) => (
              <article
                key={record.id}
                style={{
                  padding: "16px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <p>
                  <strong>
                    {record.kind === "payment"
                      ? `${record.token === zeroAddress ? `${formatUnits(BigInt(record.amount), 18)} MON` : `${record.amount} token base units`} paid to creator`
                      : `Call outcome: ${record.outcome}`}
                  </strong>
                </p>
                <p style={{ overflowWrap: "anywhere" }}>
                  Creator wallet: {record.creatorWallet}
                </p>
                {record.kind === "settlement" && (
                  <p style={{ overflowWrap: "anywhere" }}>
                    Call: {record.callId} · Entry {record.entryPrice} → Exit{" "}
                    {record.exitPrice} (oracle units). A correct price call is
                    not proof of a profitable user trade.
                  </p>
                )}
                <p>
                  Block {record.blockNumber} ·{" "}
                  {new Date(Number(record.timestamp) * 1000).toISOString()}
                </p>
                <a
                  className="text-link"
                  href={`${view.chainId === 143 ? "https://monadvision.com" : "https://testnet.monadvision.com"}/tx/${record.transactionHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View confirmed transaction ↗
                </a>
              </article>
            ))
          )}
        </Panel>
      ))}
      <p>
        Only the configured creator-fee contract and bond-free call scorecard
        are included. These records do not establish account identity, five
        profitable calls, or fee eligibility.
      </p>
    </>
  );
}
