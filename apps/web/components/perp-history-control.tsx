"use client";
import dynamic from "next/dynamic";

const ConfiguredPerpHistory = dynamic(
  () => import("./configured-perp-history"),
  { ssr: false, loading: () => <p className="small-note">Loading…</p> },
);
export function PerpHistoryControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredPerpHistory />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
