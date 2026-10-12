"use client";
import dynamic from "next/dynamic";

const ConfiguredAusdFaucet = dynamic(() => import("./configured-ausd-faucet"), {
  ssr: false,
});
export function AusdFaucetControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredAusdFaucet />
  ) : (
    <p>Privy is not configured. Claiming is unavailable.</p>
  );
}
