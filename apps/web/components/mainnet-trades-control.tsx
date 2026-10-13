"use client";
import dynamic from "next/dynamic";

const ConfiguredMainnetTrades = dynamic(
  () => import("./configured-mainnet-trades"),
  {
    ssr: false,
    loading: () => <p className="small-note">Loading…</p>,
  },
);
export function MainnetTradesControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredMainnetTrades />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
