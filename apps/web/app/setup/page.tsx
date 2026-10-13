import type { Metadata } from "next";
import { getSetupStatus } from "../../lib/server-config";

export const metadata: Metadata = { title: "System status" };

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const status = getSetupStatus();
  return (
    <div className="page subpage">
      <h1>System status</h1>
      <p className="hero-copy">
        Which integrations this deployment has configured. Configured is not the
        same as verified live.
      </p>
      <div className="setup-banner">
        <span className="signal-dot" />
        {status.chain.name} · chain {status.chain.id}
      </div>
      <div className="integration-grid">
        {status.integrations.map((item) => (
          <article key={item.name} className="integration-card">
            <div className="section-heading">
              <h2>{item.name}</h2>
              <span className="tag">
                {item.configured ? "Configured" : "Needs configuration"}
              </span>
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
      <div className="setup-instructions">
        <h2>Run locally</h2>
        <p>
          Copy <code>apps/web/.env.example</code> to{" "}
          <code>apps/web/.env.local</code>, add your Privy app ID, and enable
          Twitter login and localhost in the Privy dashboard.
        </p>
        <p>
          Keep Nansen, database, and Privy server credentials on the server. No
          provider calls or transactions run from this setup page.
        </p>
        <p>
          Installation and contract/indexer instructions are in the repository
          README.
        </p>
      </div>
    </div>
  );
}
