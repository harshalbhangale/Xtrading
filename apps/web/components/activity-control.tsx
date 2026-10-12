"use client";
import dynamic from "next/dynamic";

const ConfiguredActivity = dynamic(() => import("./configured-activity"), {
  ssr: false,
  loading: () => <p className="small-note">Loading…</p>,
});
export function ActivityControl({ view }: { view: "fills" | "all" }) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredActivity view={view} />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
