import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "For creators" };
export default function ForCreatorsPage() {
  return (
    <div className="xp-page xp-detail">
      <section className="xp-detail-hero">
        <div>
          <p className="xp-eyebrow">FOR CREATORS WITH CONVICTION</p>
          <h1>
            Your calls.
            <br />
            Your name.
            <br />
            <span className="xp-highlight">Your record.</span>
          </h1>
          <p className="xp-lead">
            Give people more than a screenshot of your winners. Build a public
            creator record with identity, refundable stake and registered calls
            people can inspect.
          </p>
          <div className="xp-actions">
            <Link className="xp-button" href="/creator">
              Enter creator studio <span>↗</span>
            </Link>
            <Link className="xp-text-link" href="/creators">
              Browse creator records →
            </Link>
          </div>
        </div>
        <div className="x-creator-sheet">
          <p className="xp-eyebrow">YOUR PUBLIC RECORD</p>
          <h2>
            Conviction,
            <br />
            on the record.
          </h2>
          <div>
            <span>01</span> X identity ↔ wallet
          </div>
          <div>
            <span>02</span> Refundable participation stake
          </div>
          <div>
            <span>03</span> Registered calls & outcomes
          </div>
          <p>Distinct evidence. Open to inspection.</p>
        </div>
      </section>
      <div className="xp-feature-grid">
        {[
          [
            "01 / BIND YOUR IDENTITY",
            "Put your name on it.",
            "Sign in with X through Privy and sign a one-time wallet message. Your binding uses a stable X user ID, so a handle change doesn’t become a new identity.",
          ],
          [
            "02 / ADD A REFUNDABLE STAKE",
            "Show commitment.",
            "Review a deposit into the configured Monad testnet stake contract. The refundable stake has a seven-day withdrawal cooldown. It shows participation, not profitable advice.",
          ],
          [
            "03 / REGISTER YOUR CALLS",
            "Build the record.",
            "Attach the source post and define a call’s terms. Open and unevaluated calls remain visible; evaluated outcomes use published rules and stay separate from your wallet returns.",
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
          <strong>A clear record beats an ambiguous badge.</strong>
          <p>
            Your identity, stake and performance remain distinct. A withdrawal
            request disables active-stake eligibility. Testnet mUSDC has no
            monetary value. Inspect current contract and provider status before
            participating.
          </p>
        </div>
        <Link href="/creator" className="xp-button">
          Open creator studio <span>↗</span>
        </Link>
      </div>
      <section className="xp-faq">
        <h2>Before your first call.</h2>
        <details>
          <summary>Can I withdraw the refundable stake?</summary>
          <p>
            The refundable stake contract supports a withdrawal request with a
            seven-day cooldown. Requesting withdrawal immediately disables
            active-stake eligibility; cancelling restores eligibility when the
            configured threshold is met.
          </p>
        </details>
        <details>
          <summary>Is the refundable stake the same as a bonded call?</summary>
          <p>
            No. Creator participation stake and bonded-call settlement are
            separate mechanisms. Review the contract and terms shown in the
            studio for the specific action you choose.
          </p>
        </details>
        <details>
          <summary>Will a binding or deposit verify my results?</summary>
          <p>
            No. Identity binding proves the account/wallet connection. Stake
            shows participation. Call performance requires evaluation; wallet
            returns require confirmed trading evidence.
          </p>
        </details>
      </section>
    </div>
  );
}
