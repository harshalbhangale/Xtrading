"use client";
import dynamic from "next/dynamic";

const Configured = dynamic(() => import("./configured-creator-dashboard"), {
  ssr: false,
  loading: () => <p className="small-note">Loading…</p>,
});
export function CreatorDashboardControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <Configured />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
