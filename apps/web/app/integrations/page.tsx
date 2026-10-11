import type { Metadata } from "next";
import { PageHeading, Panel } from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Agent access" };
const tools = [
  ["get_creator", "Identity binding for a stable X ID or handle.", "Read"],
  ["list_calls", "A creator's calls, sources and evaluation status.", "Read"],
  [
    "get_stake_status",
    "Stake balance, withdrawal state and freshness.",
    "Read",
  ],
  ["get_portfolio", "Your confirmed fills and holdings.", "Signed-in read"],
  [
    "prepare_trade",
    "A Kuru quote and unsigned transaction for you to approve.",
    "Prepare only",
  ],
] as const;
export default function IntegrationsPage() {
  return (
    <div className="page subpage integrations-page">
      <PageHeading
        title="Agent access (MCP)"
        description="An MCP server so agents can read the same evidence and prepare trades for you to sign. Not live yet."
      />
      <Panel
        title="Planned tools"
        description="Agents never sign. Trade tools return unsigned transactions only."
      >
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
    </div>
  );
}
