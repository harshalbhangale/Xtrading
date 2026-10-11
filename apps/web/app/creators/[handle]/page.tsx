import { normalizeHandle } from "@call-my-bluff/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatUnits } from "viem";
import {
  MetricCard,
  Panel,
  RecordTable,
} from "../../../components/dashboard/ui";
import { publicCreatorEvidence } from "../../../lib/public-creator";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = normalizeHandle((await params).handle);
  if (!handle) notFound();
  const evidence = await publicCreatorEvidence(handle);
  const identity = evidence?.identity;
  const stake = evidence?.stake;
  return (
    <div className="page subpage">
      <Link className="text-link" href="/creators">
        ← Creator registry
      </Link>
      <p className="eyebrow">Creator record</p>
      <h1>@{handle}</h1>
      <span className="tag">
        {identity?.status === "bound"
          ? "Account binding recorded"
          : "Binding unavailable"}
      </span>
      <div className="empty-state panel">
        <h3>
          {identity?.status === "bound"
            ? "Account binding and stake evidence"
            : "This creator has no record here yet."}
        </h3>
        <p>
          {identity?.status === "bound"
            ? `Stable X ID ${identity.xUserId}; wallet ${identity.wallet}; bound ${identity.linkedAt}. The handle is a lookup hint for the recorded binding. Call performance and wallet returns remain unavailable.`
            : "There is no verified binding, indexed stake, or scored history to display."}
        </p>
        <a
          className="text-link"
          href={`https://x.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View X profile ↗
        </a>
      </div>
      <div className="metric-grid">
        <MetricCard
          label="Verified identity"
          value={
            identity?.status === "bound" ? "Binding recorded" : "Unavailable"
          }
          detail="X authentication and signed wallet ownership at binding time; independent of stake"
          icon="◎"
        />
        <MetricCard
          label="Refundable stake"
          value={
            stake?.status === "active" && stake.balance
              ? `${formatUnits(BigInt(stake.balance), 6)} ${stake.symbol}`
              : stake?.status === "withdrawal-pending"
                ? "Withdrawal pending"
                : stake?.status === "inactive"
                  ? "Inactive"
                  : "Unavailable"
          }
          detail={`Monad testnet · Envio ${stake?.indexing?.status ?? "unavailable"} · block ${stake?.indexing?.progressBlock ?? "unavailable"} · unfinalized; demo tokens have no monetary value`}
          icon="◇"
        />
        <MetricCard
          label="Call reputation"
          detail="No methodology-backed score"
        />
        <MetricCard
          label="Source coverage"
          detail="Indexed post coverage unavailable"
          icon="≡"
        />
      </div>
      <Panel
        title="Public call history"
        description="Source posts and hypothetical call outcomes stay separate from actual wallet results."
      >
        <RecordTable
          columns={[
            "Source post",
            "Asset / direction",
            "Evaluation window",
            "Status",
            "Evidence",
          ]}
          emptyTitle="No source-backed calls to inspect."
          emptyDescription="Eligible predictions will appear after ingestion and evaluation are connected."
        />
      </Panel>
    </div>
  );
}
