import { normalizeHandle } from "@call-my-bluff/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallLedger, CallSummary } from "../../../components/call-ledger";
import { CreatorOverviewPanel } from "../../../components/creator-overview";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { DemoKolCase } from "../../../components/demo-kol-case";
import {
  KolFlags,
  TierLadder,
  TierProgress,
} from "../../../components/kol-reputation";
import { DEMO_KOL_HANDLE } from "../../../lib/demo-kol";
import { creatorReputation } from "../../../lib/insights";
import { kolRecord } from "../../../lib/kol-record";
import { publicCreatorEvidence } from "../../../lib/public-creator";

export const dynamic = "force-dynamic";
const explorer = "https://testnet.monadexplorer.com/address/";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const handle = normalizeHandle((await params).handle);
  return { title: handle ? `@${handle}` : "Creator" };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = normalizeHandle((await params).handle);
  if (!handle) notFound();
  if (handle === DEMO_KOL_HANDLE) return <DemoKolCase />;
  const [evidence, record, detected] = await Promise.all([
    publicCreatorEvidence(handle),
    kolRecord(handle, { recheck: true }).catch(() => null),
    creatorReputation(handle).catch(() => null),
  ]);
  const ledger = record?.ledger ?? null;
  const identity = evidence?.identity;
  const bound = identity?.status === "bound";
  return (
    <>
      <Link className="back-link" href="/creators">
        ← All creators
      </Link>
      <PageHeading
        eyebrow="Creator record"
        title={`@${handle}`}
        description={
          bound
            ? "This X account is bound to a wallet. Identity, reputation tier, red flags and wallet returns are shown separately."
            : "No verified binding for this handle. Nothing here should be read as a claim about this account."
        }
        action={
          <a
            className="button secondary-button"
            href={`https://x.com/${handle}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on X ↗
          </a>
        }
      />
      {record && (
        <Panel
          title="Accountability"
          description="Red flags come from evidence only: registered posts that stopped being public, trades against the creator's own calls and wrong-call rate."
        >
          <KolFlags
            assessment={record.assessment}
            calls={ledger?.calls ?? []}
          />
        </Panel>
      )}
      <Panel title="Ongoing calls & wallet activity">
        <CreatorOverviewPanel key={handle} handle={handle} />
      </Panel>
      <div className="dashboard-two-column">
        <Panel
          title="Identity"
          description="X sign-in plus a signed wallet message at binding time. Proves account ownership, not accuracy."
        >
          {bound && identity.xUserId && identity.wallet && identity.linkedAt ? (
            <dl className="evidence-list">
              <dt>Status</dt>
              <dd>Binding recorded</dd>
              <dt>Stable X ID</dt>
              <dd>{identity.xUserId}</dd>
              <dt>Wallet</dt>
              <dd>
                <a
                  href={`${explorer}${identity.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {identity.wallet}
                </a>
              </dd>
              <dt>Bound</dt>
              <dd>{new Date(identity.linkedAt).toUTCString()}</dd>
            </dl>
          ) : (
            <p className="small-note">No binding recorded.</p>
          )}
        </Panel>
        <Panel
          title="Reputation tier"
          description="Earned from scored calls; red flags demote. The tier sets this creator's cut of each buy from their posts."
        >
          {record ? (
            <>
              <TierProgress assessment={record.assessment} />
              <details>
                <summary>All tiers</summary>
                <TierLadder current={record.assessment.tier} />
              </details>
            </>
          ) : (
            <p className="small-note">Reputation is unavailable right now.</p>
          )}
        </Panel>
      </div>
      <Panel
        title="Calls"
        description="Priced at the minute of posting and scored at expiry under directional-return-v1. These are hypothetical outcomes, not wallet returns."
      >
        {ledger ? (
          <>
            <CallSummary calls={ledger.calls} />
            <CallLedger calls={ledger.calls} />
          </>
        ) : (
          <p className="small-note">
            {bound ? "Calls are unavailable right now." : "No calls recorded."}
          </p>
        )}
        <p className="small-note">
          Prices: Binance spot (BTC, ETH, SOL) and Nansen (MON on Monad
          mainnet), open of the first one-minute candle at or after each time.{" "}
          <a className="text-link" href="/methodology">
            Methodology
          </a>
        </p>
      </Panel>
      {detected?.status === "ready" && detected.recent.length > 0 && (
        <Panel
          title="Calls detected in posts"
          description={`Extracted automatically from posts seen by extension users and priced from the minute they were posted to one hour later, in the call's direction. Settled results never change. Not registered by the creator.${detected.measured?.count ? ` ${detected.measured.inFavour} of ${detected.measured.count} moved their way within 1h.` : ""}${detected.measured?.pending ? ` ${detected.measured.pending} pending.` : ""}${detected.measured?.unpriced ? ` ${detected.measured.unpriced} not priced (${detected.measured.unpricedAssets.join(", ")}).` : ""}`}
        >
          <div className="table-scroll">
            <table className="record-table">
              <thead>
                <tr>
                  <th scope="col">Post</th>
                  <th scope="col">Asset / direction</th>
                  <th scope="col">Instrument</th>
                  <th scope="col">Detected</th>
                  <th scope="col">1h after post</th>
                </tr>
              </thead>
              <tbody>
                {detected.recent.map((call) => (
                  <tr key={call.postId}>
                    <td>
                      <a
                        href={`https://x.com/${handle}/status/${call.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {call.postId} ↗
                      </a>
                    </td>
                    <td>
                      {call.asset} {call.direction ?? ""}
                    </td>
                    <td>{call.instrument}</td>
                    <td>
                      {call.classifiedAt.slice(0, 16).replace("T", " ")} UTC
                    </td>
                    <td>
                      {(() => {
                        const m = detected.measured?.items.find(
                          (i) => i.postId === call.postId,
                        );
                        return m ? (
                          <span
                            className={`call-outcome call-${m.moveBps >= 0 ? "success" : "failure"}`}
                          >
                            {m.moveBps >= 0 ? "+" : "−"}
                            {Math.abs(m.moveBps / 100).toFixed(2)}% · $
                            {m.entryPrice} → ${m.exitPrice}
                          </span>
                        ) : (
                          "—"
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
