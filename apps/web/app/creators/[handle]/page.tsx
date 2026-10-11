import { normalizeHandle } from "@call-my-bluff/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MetricCard,
  Panel,
  RecordTable,
} from "../../../components/dashboard/ui";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = normalizeHandle((await params).handle);
  if (!handle) notFound();
  return (
    <div className="page subpage">
      <Link className="text-link" href="/creators">
        ← Creator registry
      </Link>
      <p className="eyebrow">Creator record</p>
      <h1>@{handle}</h1>
      <span className="tag">Not indexed</span>
      <div className="empty-state panel">
        <h3>This creator has no record here yet.</h3>
        <p>
          There is no verified identity, indexed stake, or scored history to
          display.
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
          value="Unavailable"
          detail="No ownership proof has been loaded"
          icon="◎"
        />
        <MetricCard
          label="Refundable stake"
          detail="No current indexed stake record"
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
