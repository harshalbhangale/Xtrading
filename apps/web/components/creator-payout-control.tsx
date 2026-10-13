"use client";
import dynamic from "next/dynamic";

const ConfiguredPayout = dynamic(() => import("./configured-payout"), {
  ssr: false,
});
export function CreatorPayoutControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredPayout />
  ) : (
    <p>Sign-in is unavailable.</p>
  );
}
