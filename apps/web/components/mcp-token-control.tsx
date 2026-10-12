"use client";
import dynamic from "next/dynamic";

const ConfiguredMcpToken = dynamic(() => import("./configured-mcp-token"), {
  ssr: false,
  loading: () => <p className="small-note">Loading…</p>,
});
export function McpTokenControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredMcpToken />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
