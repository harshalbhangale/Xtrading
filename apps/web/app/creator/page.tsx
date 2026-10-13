import type { Metadata } from "next";
import Link from "next/link";
import { CreatorStatus } from "../../components/creator-status";
import { AccountSummary } from "../../components/dashboard/account-summary";
import { ActionCard, PageHeading, Panel } from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Creator studio" };

export default function CreatorPage() {
  return (
    <>
      <PageHeading
        title="Creator studio"
        description="Link X and your wallet to register creator payouts. Staking and bonded calls are optional, separate signals."
      />
      <AccountSummary audience="creator" signedOutPrompt={false} />
      <Panel
        title="Setup"
        description="Account linking enables payout registration. Staking is optional."
      >
        <Link className="button" href="/creator/earnings">
          Set up creator earnings →
        </Link>
        <CreatorStatus />
      </Panel>
      <div className="dashboard-two-column">
        <Panel
          title="How your record is read"
          description="These are shown side by side and never merged into one score."
          action={
            <Link className="text-link" href="/methodology">
              Methodology
            </Link>
          }
        >
          <dl className="signal-list">
            <div>
              <dt>Identity</dt>
              <dd>
                Your stable X ID bound to a wallet by a signed, single-use
                message. Proves ownership, not skill.
              </dd>
            </div>
            <div>
              <dt>Stake</dt>
              <dd>
                A refundable deposit with a seven-day withdrawal cooldown. Shows
                commitment, not accuracy.
              </dd>
            </div>
            <div>
              <dt>Call performance</dt>
              <dd>
                Registered calls priced at posting time and scored at expiry,
                with sample size shown next to every number.
              </dd>
            </div>
          </dl>
        </Panel>
        <div className="action-stack">
          <ActionCard
            href="/extension"
            icon="extension"
            title="Install the X extension"
            description="Show your record next to your posts"
          />
          <ActionCard
            href="/integrations"
            icon="agent"
            title="Agent access"
            description="Let agents read your public record"
          />
          <ActionCard
            href="/creators"
            icon="creators"
            title="Other creators"
            description="See how bound accounts appear"
          />
        </div>
      </div>
    </>
  );
}
