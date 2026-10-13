import type { Metadata } from "next";
import { PageHeading, Panel } from "../../components/dashboard/ui";
import { McpTokenControl } from "../../components/mcp-token-control";

export const metadata: Metadata = { title: "Agent access" };
const tools = [
  ["get_creator", "Identity binding for an X handle.", "Read"],
  ["list_calls", "Registered calls, prices and scored outcomes.", "Read"],
  ["get_markets", "Kuru spot books and open Perpl markets.", "Read"],
  ["quote_trade", "Indicative Kuru output from the order book.", "Read"],
  ["classify_post", "Detect a trade call in a post's text.", "Read"],
  ["get_portfolio", "Your balances and confirmed Kuru fills.", "Signed in"],
  [
    "prepare_trade",
    "One unsigned Kuru transaction for you to approve in your wallet.",
    "Signed in · prepare only",
  ],
] as const;

export default function IntegrationsPage() {
  const endpoint = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/mcp`;
  return (
    <>
      <PageHeading
        title="Agent access (MCP)"
        description="A Model Context Protocol server so agents can read the same evidence and prepare trades for you to sign. Agents never sign or submit."
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
            Add <code>--header "Authorization: Bearer &lt;token&gt;"</code> with
            a session token from below. Tokens expire in about an hour.
          </dd>
        </dl>
      </Panel>
      <Panel
        title="Session token"
        description="Lets an agent read your portfolio and prepare trades as you. It cannot sign, withdraw or move funds. Treat it like a password."
      >
        <McpTokenControl />
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
