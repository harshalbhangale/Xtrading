"use client";
import dynamic from "next/dynamic";

const ConfiguredMcpToken = dynamic(() => import("./configured-mcp-token"), {
  ssr: false,
  loading: () => <p className="small-note">Loading…</p>,
});
export function McpTokenControl({ endpoint }: { endpoint: string }) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredMcpToken endpoint={endpoint} />
  ) : (
    <p className="small-note">Sign-in is not configured for this deployment.</p>
  );
}
