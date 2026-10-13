import type { Metadata } from "next";
import Link from "next/link";
import { CreatorProgram } from "../../components/creator-program";
import { LandingMotion } from "../../components/landing-motion";

export const metadata: Metadata = { title: "For creators" };
export default function ForCreatorsPage() {
  return (
    <LandingMotion className="xp-detail x-for-creators">
      <section className="xp-detail-hero">
        <div>
          <p className="xp-eyebrow">FOR CREATORS WITH CONVICTION</p>
          <h1>
            Your calls.
            <br />
            Your audience.
            <br />
            <span className="xp-highlight">Your earnings.</span>
          </h1>
          <p className="xp-lead">
            Link your X identity and payout wallet. Register for eligible
            creator fees, build an inspectable call history, and grow your
            reputation.
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
            <span>02</span> Registered calls & outcomes
          </div>
          <div>
            <span>03</span> Tier & earnings
          </div>
          <p>Distinct evidence. Open to inspection.</p>
        </div>
      </section>
      <CreatorProgram />
      <div className="xp-feature-grid">
        {[
          [
            "01 / BIND YOUR IDENTITY",
            "Put your name on it.",
            "Sign in with X through Privy and sign a one-time wallet message. Your binding uses a stable X user ID, so a handle change doesn’t become a new identity.",
          ],
          [
            "02 / REGISTER YOUR CALLS",
            "Build the record.",
            "Attach the source post and define the asset, direction, target and deadline. Terms stay fixed and all outcomes remain visible.",
          ],
          [
            "03 / EARN AS THE RECORD GROWS",
            "Pro, Max, then Ultra.",
            "Every buy from your post pays you 0.1% when verified; scored calls raise it to 0.5% (Pro), 1% (Max) and 2% (Ultra). Red flags demote. No staking and no subscription.",
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
            Account ownership, call outcomes and actual user profit are separate
            records. Keep the full history visible, including incorrect calls.
            Tiers are earned from scored calls; they cannot be bought.
          </p>
        </div>
        <Link href="/creator" className="xp-button">
          Open creator studio <span>↗</span>
        </Link>
      </div>
      <section className="xp-faq">
        <h2>Before your first call.</h2>
        <details>
          <summary>How do I move up a tier?</summary>
          <p>
            Xtrading Pro needs 5 scored calls with at least half right; Max
            needs 15 with 60% right and a positive median return; Ultra needs 30
            with 65% right and a positive median at 7 days. Each serious red
            flag, such as a deleted call or trading against your own call, costs
            one tier. Track progress in the creator studio.
          </p>
        </details>
        <details>
          <summary>Does a correct call prove users made money?</summary>
          <p>
            No. A correct price prediction is separate from an actual user's
            returns. Profit requires a confirmed closed trade after trading fees
            and gas.
          </p>
        </details>
        <details>
          <summary>Do I need to deposit funds to become a creator?</summary>
          <p>
            No. Link your X account and wallet, then register calls. Existing
            deposits can still be recovered through the{" "}
            <Link href="/creator/stake">previous-deposit recovery page</Link>.
          </p>
        </details>
      </section>
    </LandingMotion>
  );
}
