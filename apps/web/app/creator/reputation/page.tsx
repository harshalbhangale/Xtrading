import type { Metadata } from "next";
import {
  ConnectionNote,
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Reputation" };

export default function ReputationPage() {
  return (
    <>
      <PageHeading
        eyebrow="05 / Reputation"
        title="A score needs a source."
        description="Transparent call performance, enough context to interpret it, and evidence you can inspect."
      />
      <div className="metric-grid">
        <MetricCard
          label="Reputation score"
          detail="No methodology-backed score available"
        />
        <MetricCard
          label="Evaluated calls"
          detail="Eligible call dataset not connected"
        />
        <MetricCard
          label="Source coverage"
          detail="Indexed post coverage unavailable"
        />
        <MetricCard
          label="Methodology version"
          detail="Scoring model not published yet"
          icon="≡"
        />
      </div>
      <Panel
        title="Performance over time"
        description="Scored calls will include their evaluation window and observation timestamp."
      >
        <EmptyState
          title="Evidence before a number."
          description="The chart remains empty until sufficient eligible calls can be evaluated using a published methodology."
        />
      </Panel>
      <div className="evidence-principles">
        <article>
          <span>01 / Ownership</span>
          <h3>Identity is a proof.</h3>
          <p>
            Verified X control and wallet ownership establish who is making a
            call.
          </p>
        </article>
        <article>
          <span>02 / Participation</span>
          <h3>Stake is a deposit.</h3>
          <p>
            A refundable stake shows commitment to participation. It is not a
            profitability score.
          </p>
        </article>
        <article>
          <span>03 / Performance</span>
          <h3>Reputation is evidence.</h3>
          <p>
            Call outcomes need timestamps, sample size, coverage and an explicit
            evaluation method.
          </p>
        </article>
      </div>
      <ConnectionNote>
        Nansen insights will be sourced and timestamped separately. Missing
        asset or network coverage remains visible.
      </ConnectionNote>
    </>
  );
}
