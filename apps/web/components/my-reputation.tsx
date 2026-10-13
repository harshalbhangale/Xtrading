"use client";
import dynamic from "next/dynamic";

const ConfiguredMyReputation = dynamic(
  () => import("./configured-my-reputation"),
  { ssr: false, loading: () => <p className="small-note">Loading…</p> },
);
export function MyReputation({ full = false }: { full?: boolean }) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredMyReputation full={full} />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
