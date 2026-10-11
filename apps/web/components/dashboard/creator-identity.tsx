"use client";
import dynamic from "next/dynamic";
import { MetricCard } from "./ui";

const IdentitySummary = dynamic(
  () => import("./identity-summary").then((m) => m.IdentitySummary),
  { ssr: false },
);
const IdentityStepStatus = dynamic(
  () => import("./identity-step-status").then((m) => m.IdentityStepStatus),
  { ssr: false },
);

export function CreatorIdentityCard({
  serverConfigured,
}: {
  serverConfigured: boolean;
}) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID && serverConfigured ? (
    <IdentitySummary />
  ) : (
    <MetricCard
      label="Identity"
      value="Unlinked"
      detail="Identity verification is unavailable until Privy is configured"
      icon="◎"
    />
  );
}

export function CreatorIdentityStep({
  serverConfigured,
}: {
  serverConfigured: boolean;
}) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID && serverConfigured ? (
    <IdentityStepStatus />
  ) : (
    <span className="status-badge">Not completed</span>
  );
}
