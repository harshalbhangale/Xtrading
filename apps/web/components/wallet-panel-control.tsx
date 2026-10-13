"use client";
import dynamic from "next/dynamic";

const ConfiguredWalletPanel = dynamic(
  () => import("./configured-wallet-panel"),
  { ssr: false, loading: () => <p className="small-note">Loading…</p> },
);
export function WalletPanelControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredWalletPanel />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
