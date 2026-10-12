import type { Metadata } from "next";
import Link from "next/link";
import { LiveXDemo } from "../../components/live-x-demo";

export const metadata: Metadata = { title: "How it works" };
export default function HowItWorksPage() {
  return (
    <div className="xp-page xp-detail">
      <section className="xp-detail-hero">
        <div>
          <p className="xp-eyebrow">THE PATH FROM POST TO POSITION</p>
          <h1>
            See the call.
            <br />
            Check the record.
            <br />
            <span className="xp-highlight">Make your move.</span>
          </h1>
          <p className="xp-lead">
            An X post starts the conversation. Xtrading brings the creator’s
            evidence and a reviewed trade into the same flow.
          </p>
          <Link className="xp-button" href="/extension">
            Get the extension <span>↗</span>
          </Link>
        </div>
        <LiveXDemo />
      </section>
      <div className="xp-feature-grid">
        {[
          [
            "01 / DISCOVER",
            "Start where the call happens.",
            "The Chrome extension recognizes explicit trade calls in the posts you view on X. Open the call drawer for context and keep the original source attached.",
          ],
          [
            "02 / INSPECT",
            "Ask four different questions.",
            "Who owns this X identity? Is their refundable stake active? How did registered calls perform? What do confirmed wallet trades show? Missing evidence stays unavailable.",
          ],
          [
            "03 / REVIEW",
            "Make an informed trade.",
            "Open the workspace, choose a configured market and review your amount, quote and transaction. Signing stays with your wallet. Submitted orders are not confirmed fills.",
          ],
        ].map(([n, title, copy]) => (
          <article className="xp-detail-card" key={n}>
            <span>{n}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
      <div className="xp-detail-note">
        <div>
          <strong>Evidence is only useful with its limits.</strong>
          <p>
            Call results are evaluated under published rules. They are distinct
            from actual wallet returns. Nansen context depends on provider
            coverage; Envio projections depend on indexing freshness. Current
            execution defaults to Monad testnet, chain 10143.
          </p>
        </div>
        <Link href="/methodology" className="xp-text-link">
          Read the methodology ↗
        </Link>
      </div>
      <section className="xp-faq">
        <h2>A little more context.</h2>
        <details>
          <summary>Does a verified identity mean a good trader?</summary>
          <p>
            No. Identity binding connects a stable X user ID to a wallet. It
            does not establish trading skill, returns or the accuracy of any
            call.
          </p>
        </details>
        <details>
          <summary>Does Xtrading trade automatically?</summary>
          <p>
            Trades require your review and wallet approval. The landing preview
            is illustrative and never submits an order or asks for a signature.
          </p>
        </details>
        <details>
          <summary>Are all integrations live?</summary>
          <p>
            Availability depends on configured markets, credentials and provider
            coverage. Check system status for current configuration, and inspect
            transaction evidence for confirmed activity.
          </p>
          <Link className="xp-text-link" href="/setup">
            View system status ↗
          </Link>
        </details>
      </section>
    </div>
  );
}
