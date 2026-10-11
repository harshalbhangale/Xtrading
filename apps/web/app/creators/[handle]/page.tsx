import { normalizeHandle } from "@call-my-bluff/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallLedger, CallSummary } from "../../../components/call-ledger";
import { Panel } from "../../../components/dashboard/ui";
import { publicCallLedger } from "../../../lib/calls";
import { publicCreatorEvidence } from "../../../lib/public-creator";
import { stakeLabel } from "../../../lib/stake-label";

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
  const [evidence, ledger] = await Promise.all([
    publicCreatorEvidence(handle),
    publicCallLedger(handle).catch(() => null),
  ]);
  const identity = evidence?.identity;
  const stake = evidence?.stake;
  const bound = identity?.status === "bound";
  return (
    <div className="page subpage">
      <Link className="text-link back-link" href="/creators">
        ← All creators
      </Link>
      <h1>@{handle}</h1>
      <p className="hero-copy">
        {bound
          ? "This X account is bound to a wallet. Identity, stake and call performance are shown separately."
          : "No verified binding for this handle. Nothing here should be read as a claim about this account."}{" "}
        <a
          className="text-link"
          href={`https://x.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on X ↗
        </a>
      </p>
      <div className="dashboard-two-column">
        <Panel
          title="Identity"
          description="X sign-in plus a signed wallet message at binding time. Says nothing about stake or accuracy."
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
          title="Refundable stake"
          description="Read from the stake contract and cross-checked against the Envio index. Demo tokens have no monetary value."
        >
          <dl className="evidence-list">
            <dt>Status</dt>
            <dd>{stake ? stakeLabel(stake) : "Unavailable"}</dd>
            <dt>Network</dt>
            <dd>Monad testnet (10143)</dd>
            {stake?.contract && (
              <>
                <dt>Contract</dt>
                <dd>
                  <a
                    href={`${explorer}${stake.contract}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {stake.contract}
                  </a>
                </dd>
              </>
            )}
            <dt>Indexer</dt>
            <dd>
              {stake?.indexing
                ? `${stake.indexing.status}, block ${stake.indexing.progressBlock ?? "—"} (unfinalized)`
                : "Unavailable"}
            </dd>
          </dl>
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
    </div>
  );
}
