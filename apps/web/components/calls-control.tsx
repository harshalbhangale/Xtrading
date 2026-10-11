"use client";
import dynamic from "next/dynamic";

const ConfiguredCalls = dynamic(() => import("./configured-calls"), {
  ssr: false,
  loading: () => <p className="small-note">Loading…</p>,
});
export function CallsControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredCalls />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
