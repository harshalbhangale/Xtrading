"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

type Status = {
  connected: boolean;
  client: string | null;
  lastTool: string | null;
  calls: number;
  lastSeenAt: string | null;
};

function ago(iso: string) {
  const seconds = Math.max(
    0,
    Math.round((Date.now() - Date.parse(iso)) / 1000),
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ConfiguredMcpToken({ endpoint }: { endpoint: string }) {
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  // Polls the user's own agent status so a new connection shows up within seconds.
  useEffect(() => {
    if (!authenticated) return;
    let stop = false;
    const read = async () => {
      const token = await getAccessToken();
      if (!token || stop) return;
      const response = await fetch("/api/agent/connection", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (!stop && response?.ok) setStatus((await response.json()) as Status);
    };
    void read();
    const timer = setInterval(() => void read(), 10_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [authenticated, getAccessToken]);
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
  const live =
    status?.lastSeenAt &&
    Date.now() - Date.parse(status.lastSeenAt) < 15 * 60_000;
  return (
    <>
      <p className="agent-status" role="status">
        <span
          className="status-badge"
          data-tone={
            live ? "positive" : status?.connected ? "warning" : undefined
          }
        >
          {live
            ? "Agent connected"
            : status?.connected
              ? "Agent seen before"
              : "Not connected yet"}
        </span>{" "}
        {status?.connected && status.lastSeenAt
          ? `${status.client ?? "Agent"} · last call ${ago(status.lastSeenAt)}${status.lastTool ? ` · ${status.lastTool}` : ""} · ${status.calls} tool calls`
          : "Connect Claude below, then ask it anything about Xtrading. This turns green on its first signed-in call."}
      </p>
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
          className="button"
          onClick={() =>
            void copy(
              (token) =>
                JSON.stringify(
                  {
                    mcpServers: {
                      xtrading: {
                        command: "npx",
                        args: [
                          "-y",
                          "mcp-remote",
                          endpoint,
                          "--header",
                          // biome-ignore lint/suspicious/noTemplateCurlyInString: mcp-remote expands this env var itself.
                          "Authorization:${XTRADING_AUTH}",
                        ],
                        env: { XTRADING_AUTH: `Bearer ${token}` },
                      },
                    },
                  },
                  null,
                  2,
                ),
              "Copied the Claude Desktop config with your token. In Claude Desktop: Settings → Developer → Edit Config, merge it into mcpServers, save, then restart Claude Desktop.",
            )
          }
        >
          Copy Claude Desktop config
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
