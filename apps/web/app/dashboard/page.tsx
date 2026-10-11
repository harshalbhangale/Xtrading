import type { Metadata } from "next";
import Link from "next/link";
import { CreatorSearch } from "../../components/creator-search";
import {
  ConnectionNote,
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
} from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Your dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="01 / Overview"
        title="Your edge is evidence."
        description="Follow creators, inspect their record, and keep your own trades in view."
        action={
          <Link className="button" href="/terminal">
            Explore the terminal ↗
          </Link>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Portfolio value"
          detail="Requires confirmed holdings and prices"
        />
        <MetricCard
          label="Realized return"
          detail="Calculated from actual fills, after fees"
        />
        <MetricCard
          label="Confirmed trades"
          detail="Waiting for indexed wallet activity"
          icon="≡"
        />
        <MetricCard
          label="Creator coverage"
          detail="Waiting for a connected account"
          icon="◎"
        />
      </div>
      <div className="dashboard-two-column">
        <Panel
          title="Your trading record"
          description="Actual execution. Every fee. Every source post."
          action={
            <Link className="text-link" href="/dashboard/portfolio">
              View portfolio ↗
            </Link>
          }
        >
          <div className="chart-placeholder">
            <div className="chart-grid" aria-hidden="true" />
            <EmptyState
              title="A real trade starts the chart."
              description="Connect your wallet and confirm a trade. Indexed fills will build your portfolio history."
              href="/setup"
              action="Set up a wallet"
            />
          </div>
        </Panel>
        <div className="dashboard-callout">
          <p className="eyebrow">Bring the record into the feed</p>
          <span className="callout-symbol" aria-hidden="true">
            ↗
          </span>
          <h2>
            Less tab hopping.
            <br />
            More context.
          </h2>
          <p>
            Your X extension will put identity, stake and call evidence next to
            the conversation.
          </p>
          <Link className="button light-button" href="/extension">
            Explore the extension ↗
          </Link>
        </div>
      </div>
      <Panel
        title="Find your next creator"
        description="Start with an X handle. Inspect the evidence before adding conviction."
      >
        <CreatorSearch />
      </Panel>
      <Panel
        title="A trade starts with a review"
        description="See the venue, amounts, fees and approval before signing."
      >
        <Link className="button secondary-button" href="/dashboard/trade">
          Open trade review ↗
        </Link>
      </Panel>
      <ConnectionNote>
        Dashboard values stay unavailable until their data source is connected.
        An empty chart does not mean a zero balance.
      </ConnectionNote>
    </>
  );
}
