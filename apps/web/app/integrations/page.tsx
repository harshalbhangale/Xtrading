import type { Metadata } from "next";
import { AgentPromptBuilder } from "../../components/agent-prompt-builder";
import { PageHeading, Panel } from "../../components/dashboard/ui";
import { McpTokenControl } from "../../components/mcp-token-control";

export const metadata: Metadata = { title: "Agent access" };
const tools = [
  ["get_creator", "Identity binding for an X handle.", "Read"],
  ["list_calls", "Registered calls, prices and scored outcomes.", "Read"],
  ["get_markets", "Kuru spot books and open Perpl markets.", "Read"],
  [
    "quote_trade",
    "Indicative Kuru output from the order book, testnet or mainnet.",
    "Read",
  ],
  ["classify_post", "Detect a trade call in a post's text.", "Read"],
  ["recent_calls", "Calls detected in a creator's recent posts.", "Read"],
  ["get_portfolio", "Your balances and confirmed Kuru fills.", "Signed in"],
  [
    "get_position",
    "Your mainnet position, cost and profit from your trade receipts.",
    "Signed in",
  ],
  [
    "prepare_trade",
    "One unsigned Kuru transaction and an approval link for you to sign.",
    "Signed in · prepare only",
  ],
] as const;

export default function IntegrationsPage() {
  const endpoint = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp`;
  return (
    <>
      <PageHeading
        title="Agent access (MCP)"
        description="A Model Context Protocol server so agents can read the same evidence and prepare trades for you to sign, on Monad testnet or mainnet. Agents never sign or submit."
      />
      <Panel
        title="Connect"
        description="Streamable HTTP, no session state. Public tools need nothing else."
      >
        <dl className="evidence-list">
          <dt>Endpoint</dt>
          <dd>
            <code>{endpoint}</code>
          </dd>
          <dt>Claude Code</dt>
          <dd>
            <code>claude mcp add --transport http xtrading {endpoint}</code>
          </dd>
          <dt>Signed-in tools</dt>
          <dd>
            Use <strong>Copy Claude Code command</strong> below: it fills in
            your session token. Tokens expire in about an hour; copy again when
            calls ask for a session.
          </dd>
        </dl>
      </Panel>
      <Panel
        title="Session token"
        description="Lets an agent read your portfolio and prepare trades as you. It cannot sign, withdraw or move funds. Treat it like a password."
      >
        <McpTokenControl endpoint={endpoint} />
      </Panel>
      <Panel
        title="Follow a creator and take profit"
        description="A ready prompt for Claude Code. When the creator posts a bullish spot call, the agent prepares the buy; when your position is up by your target, it prepares the sell. You sign both."
      >
        <AgentPromptBuilder />
      </Panel>
      <Panel title="Tools">
        <div className="tool-list">
          {tools.map(([name, purpose, kind]) => (
            <article key={name}>
              <div>
                <code>{name}</code>
                <span className="status-badge">{kind}</span>
              </div>
              <p>{purpose}</p>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}
