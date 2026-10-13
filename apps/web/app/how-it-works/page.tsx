import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedFlow } from "../../components/animated-flow";
import { LandingMotion } from "../../components/landing-motion";
import { LiveXDemo } from "../../components/live-x-demo";

export const metadata: Metadata = { title: "How it works" };
export default function HowItWorksPage() {
  return (
    <LandingMotion className="xp-detail x-how-page">
      <section className="xp-detail-hero">
        <div>
          <p className="xp-eyebrow">THE PATH FROM POST TO POSITION</p>
          <h1>
            Find your KOL.
            <br />
            Spot or perps.
            <br />
            <span className="xp-highlight">Right from X.</span>
          </h1>
          <p className="xp-lead">
            Discover your favourite creator’s post, choose a supported trade,
            and approve it in your wallet. Keep the trading flow connected to
            your Twitter / X feed.
          </p>
          <Link className="xp-button" href="/extension">
            Get the extension <span>↗</span>
          </Link>
        </div>
      </section>
      <AnimatedFlow />
      <section id="try-it" className="x-how-demo">
        <p className="xp-eyebrow">NOW TRY IT / A REAL PUBLIC POST</p>
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
            "02 / TRADE",
            "Choose spot or perps.",
            "Buy or sell a supported token with Kuru spot, or launch a supported Perpl perp review from the post. Choose your market, amount and trade details.",
          ],
          [
            "03 / REVIEW",
            "Approve. Track. Keep scrolling.",
            "Review the quote, fees and risks, then approve in your wallet. Track transaction status and confirmed fills in your dashboard while you discover the next post.",
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
    </LandingMotion>
  );
}
