import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeading, Panel } from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Agent connections" };
const tools = [
  {
    name: "get_creator",
    purpose: "Look up a verified creator by stable X ID or handle.",
    kind: "Read",
  },
  {
    name: "list_calls",
    purpose: "Inspect source posts, evaluation status and evidence coverage.",
    kind: "Read",
  },
  {
    name: "get_stake_status",
    purpose: "Read stake balance, withdrawal state and data freshness.",
    kind: "Read",
  },
  {
    name: "get_portfolio",
    purpose: "Read an authorized user's confirmed fills and holdings.",
    kind: "Authorized read",
  },
  {
    name: "prepare_trade",
    purpose:
      "Prepare a supported Kuru quote and unsigned transaction for wallet review.",
    kind: "Prepare only",
  },
];
export default function IntegrationsPage() {
  return (
    <div className="page subpage integrations-page">
      <PageHeading
        eyebrow="Agent connections / MCP"
        title="Give agents the receipts."
        description="The planned No More Bluff MCP will expose creator evidence and prepare trades for human approval."
        action={
          <Link className="button secondary-button" href="/dashboard">
            Back to your workspace ↗
          </Link>
        }
      />
      <div className="dashboard-two-column">
        <Panel
          title="No More Bluff MCP"
          description="Planned interface. There is no deployed endpoint or connectable server yet."
        >
          <EmptyState
            title="The connection is next."
            description="Authentication, tool handlers and transport will be implemented after the shared backend services are available."
            icon="⌘"
          />
          <button className="button" type="button" disabled>
            Connection unavailable
          </button>
        </Panel>
        <div className="editorial-note">
          <p className="eyebrow">Your agent. Your approval.</p>
          <h2>
            Research can be delegated.
            <br />
            Signing stays with you.
          </h2>
          <p>
            Public evidence tools will disclose coverage and freshness.
            Portfolio tools require an authorized user session. Trade
            preparation will return an unsigned transaction, never an automatic
            trade.
          </p>
          <p>
            Provider credentials stay on the server. No private keys are
            collected by this interface.
          </p>
        </div>
      </div>
      <Panel
        title="Planned tool surface"
        description="Proposed tool names for the backend developer; these are not callable yet."
      >
        <div className="tool-list">
          {tools.map((tool) => (
            <article key={tool.name}>
              <div>
                <code>{tool.name}</code>
                <span className="status-badge">{tool.kind}</span>
              </div>
              <p>{tool.purpose}</p>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}
