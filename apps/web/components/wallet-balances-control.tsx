"use client";
import dynamic from "next/dynamic";

const ConfiguredWalletBalances = dynamic(
  () => import("./configured-wallet-balances"),
  { ssr: false, loading: () => <p className="small-note">Loading…</p> },
);
export function WalletBalancesControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredWalletBalances />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
