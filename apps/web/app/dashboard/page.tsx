import type { Metadata } from "next";
import Link from "next/link";
import { CreatorSearch } from "../../components/creator-search";
import { EmptyState, PageHeading, Panel } from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        title="Dashboard"
        description="Check a creator's record, then trade with every amount shown before you sign."
      />
      <div className="dashboard-two-column">
        <Panel
          title="Look up a creator"
          description="Identity binding and stake status for any X handle."
        >
          <CreatorSearch />
        </Panel>
        <Panel
          title="Trade MON / USDC"
          description="Kuru spot on Monad testnet. Simulated before you open your wallet."
        >
          <Link className="button" href="/dashboard/trade">
            Open trade review ↗
          </Link>
        </Panel>
      </div>
      <Panel
        title="Your trades"
        action={
          <Link className="text-link" href="/dashboard/portfolio">
            Portfolio ↗
          </Link>
        }
      >
        <EmptyState
          title="No confirmed fills yet."
          description="Trades appear here once a fill is confirmed onchain. An empty list is not a zero balance."
        />
      </Panel>
    </>
  );
}
