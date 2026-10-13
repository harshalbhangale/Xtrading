"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";

export default function ConfiguredMcpToken({ endpoint }: { endpoint: string }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [notice, setNotice] = useState("");
  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={login}>
        Sign in to get a token
      </button>
    );
  async function copy(build: (token: string) => string, done: string) {
    const token = await getAccessToken();
    if (!token) {
      setNotice("Session expired. Sign in again.");
      return;
    }
    try {
      await navigator.clipboard.writeText(build(token));
      setNotice(done);
    } catch {
      setNotice("Clipboard unavailable in this browser.");
    }
  }
  return (
    <>
      <div className="table-actions">
        <button
          type="button"
          className="button"
          onClick={() =>
            void copy(
              (token) =>
                `claude mcp remove xtrading 2>/dev/null; claude mcp add --transport http xtrading ${endpoint} --header "Authorization: Bearer ${token}"`,
              "Copied the Claude Code command with your token. Run it in a terminal, then start a new Claude Code session.",
            )
          }
        >
          Copy Claude Code command
        </button>
        <button
          type="button"
          className="inline-button"
          onClick={() =>
            void copy(
              (token) => token,
              "Copied. Paste it only into your own agent's config.",
            )
          }
        >
          Copy token only
        </button>
      </div>
      {notice && (
        <p className="small-note" role="status">
          {notice}
        </p>
      )}
    </>
  );
}
