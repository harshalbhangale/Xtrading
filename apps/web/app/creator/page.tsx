import type { Metadata } from "next";
import Link from "next/link";
import {
  ConnectionNote,
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
} from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Creator studio" };

export default function CreatorPage() {
  const steps = [
    {
      number: "01",
      title: "Link your identity",
      description: "Prove control of your X account and wallet.",
      href: "/creator/profile",
      action: "Set up your profile",
    },
    {
      number: "02",
      title: "Back your words",
      description: "Lock a refundable stake after identity verification.",
      href: "/creator/stake",
      action: "Explore staking",
    },
    {
      number: "03",
      title: "Build a public record",
      description:
        "Indexed financial calls become evidence your audience can inspect.",
      href: "/creator/calls",
      action: "Review your calls",
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="01 / Creator overview"
        title="Make your conviction visible."
        description="Your identity, stake and performance have their own receipts. Keep all three in one place."
        action={
          <Link className="button" href="/creator/profile">
            Set up your identity ↗
          </Link>
        }
      />
      <div className="metric-grid">
        <MetricCard
          label="Identity"
          value="Unlinked"
          detail="X ownership has not been verified"
          icon="◎"
        />
        <MetricCard
          label="Refundable stake"
          detail="Contract balance not connected"
          icon="◇"
        />
        <MetricCard
          label="Reputation"
          detail="No scored call history available"
        />
        <MetricCard
          label="Indexed calls"
          detail="Source coverage not connected"
          icon="≡"
        />
      </div>
      <Panel
        title="Your first three receipts"
        description="A clear path from account ownership to a public track record."
      >
        <div className="onboarding-grid">
          {steps.map((step) => (
            <article key={step.number}>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
              <span className="status-badge">Not completed</span>
              <Link className="text-link" href={step.href}>
                {step.action} ↗
              </Link>
            </article>
          ))}
        </div>
      </Panel>
      <div className="dashboard-two-column">
        <Panel
          title="Call performance"
          description="Hypothetical call outcomes, with methodology and coverage."
        >
          <EmptyState
            title="Let the evidence accumulate."
            description="A score will appear only when eligible, timestamped calls can be evaluated."
            href="/creator/reputation"
            action="Understand the methodology"
          />
        </Panel>
        <Panel
          title="Your extension presence"
          description="Visible to people who have the extension installed."
        >
          <EmptyState
            title="A badge starts with verified ownership."
            description="Identity linking and a current indexed stake are required before stake eligibility is shown."
            href="/extension"
            action="See the extension experience"
            icon="◎"
          />
        </Panel>
      </div>
      <ConnectionNote>
        This studio is a frontend foundation. It has not verified your account
        or fetched your wallet balance.
      </ConnectionNote>
    </>
  );
}
