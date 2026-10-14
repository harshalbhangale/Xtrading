"use client";
import dynamic from "next/dynamic";

const ConfiguredConsent = dynamic(() => import("./configured-oauth-consent"), {
  ssr: false,
  loading: () => <p className="small-note">Loading…</p>,
});
export function ConsentControl({ query }: { query: string }) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredConsent query={query} />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
