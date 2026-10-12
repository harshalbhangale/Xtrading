import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActivityControl } from "../../components/activity-control";
import { CreatorSearch } from "../../components/creator-search";
import { AccountSummary } from "../../components/dashboard/account-summary";
import { ActionCard, PageHeading, Panel } from "../../components/dashboard/ui";
import { MarketBooks } from "../../components/market-books";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <>
      <PageHeading
        title="Overview"
        description="Check who is behind a call, review the trade in full, then follow what actually settled."
      />
      <AccountSummary audience="user" />
      <div className="action-grid">
        <ActionCard
          href="/dashboard/trade"
          icon="trade"
          title="Spot trade"
          description="MON, WETH and WBTC on Kuru"
        />
        <ActionCard
          href="/dashboard/trade?instrument=perp"
          icon="activity"
          title="Perp trade"
          description="Capped-leverage orders on Perpl"
        />
        <ActionCard
          href="/creators"
          icon="creators"
          title="Browse creators"
          description="Bound accounts and their records"
        />
        <ActionCard
          href="/dashboard/faucet"
          icon="faucet"
          title="Get test funds"
          description="Testnet AUSD for Perpl"
        />
      </div>
      <div className="dashboard-two-column">
        <Panel
          title="Markets"
          description="Best bid and ask on Monad testnet."
          action={
            <Link className="text-link" href="/dashboard/trade">
              Trade
            </Link>
          }
        >
          <Suspense
            fallback={<p className="small-note">Reading order books…</p>}
          >
            <MarketBooks />
          </Suspense>
        </Panel>
        <Panel
          title="Look up a creator"
          description="Identity binding, stake and calls for any X handle."
        >
          <CreatorSearch />
          <dl className="signal-list lookup-list">
            <div>
              <dt>Identity</dt>
              <dd>Whether the X account is bound to a wallet.</dd>
            </div>
            <div>
              <dt>Stake</dt>
              <dd>A refundable deposit. Commitment, not accuracy.</dd>
            </div>
            <div>
              <dt>Calls</dt>
              <dd>Registered predictions, scored at expiry.</dd>
            </div>
          </dl>
        </Panel>
      </div>
      <Panel
        title="Recent fills"
        description="Your latest confirmed Kuru swaps."
        action={
          <Link className="text-link" href="/dashboard/activity">
            All activity
          </Link>
        }
      >
        <ActivityControl view="recent" />
      </Panel>
    </>
  );
}
