import { formatUnits, zeroAddress } from "viem";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { envioEvidence } from "../../../lib/envio-evidence";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export default async function OnchainPage() {
  const views = [await envioEvidence(143)];
  return (
    <>
      <PageHeading
        eyebrow="Envio"
        title="Onchain evidence"
        description="Real creator payments discovered through Envio HyperSync and checked against chain receipts. No wallet connection needed."
      />
      {views.map((view) => (
        <Panel
          key={view.chainId}
          title="Creator payments · Monad mainnet"
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
                    {`${record.token === zeroAddress ? `${formatUnits(BigInt(record.amount), 18)} MON` : `${record.amount} token base units`} paid to creator`}
                  </strong>
                </p>
                <p style={{ overflowWrap: "anywhere" }}>
                  Creator wallet: {record.creatorWallet}
                </p>
                <p>
                  Block {record.blockNumber} ·{" "}
                  {new Date(Number(record.timestamp) * 1000).toISOString()}
                </p>
                <a
                  className="text-link"
                  href={`https://monadvision.com/tx/${record.transactionHash}`}
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
        Only the configured creator-fee contract is included. These records do
        not establish account identity, five profitable calls, or fee
        eligibility.
      </p>
    </>
  );
}
