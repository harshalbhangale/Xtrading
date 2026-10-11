import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Call My Bluff — put conviction on the record",
};

export default function LandingPage() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">
            <span className="signal-dot" /> The record behind the recommendation
          </p>
          <h1>
            Big claims.
            <br />
            Real <span className="highlight">receipts.</span>
          </h1>
          <p>
            Anyone can call the next big thing.
            <br />
            Give conviction a record people can inspect.
          </p>
          <div className="button-row">
            <Link className="button lime-button" href="/dashboard">
              Explore the user platform ↗
            </Link>
            <Link className="text-link" href="/creator">
              I’m a creator ↗
            </Link>
          </div>
          <div className="landing-caption">
            <span>Built on Monad</span>
            <span>Evidence before execution</span>
          </div>
        </div>
        <div className="landing-record">
          <div className="receipt-top">
            <span>CALL MY BLUFF</span>
            <span>THE PUBLIC RECORD / 01</span>
          </div>
          <div className="receipt-arrow" aria-hidden="true">
            ↗
          </div>
          <h2>
            Conviction,
            <br />
            with receipts.
          </h2>
          <div className="receipt-line">
            <span>01</span>
            <strong>Identity</strong>
            <span>Who made the call?</span>
          </div>
          <div className="receipt-line">
            <span>02</span>
            <strong>Stake</strong>
            <span>What backs their participation?</span>
          </div>
          <div className="receipt-line">
            <span>03</span>
            <strong>Evidence</strong>
            <span>What does the record show?</span>
          </div>
          <div className="receipt-foot">
            <span>Three signals. Independently verifiable.</span>
            <span aria-hidden="true">▥▥▥▥▥</span>
          </div>
        </div>
      </section>
      <section className="landing-strip">
        <span>From the feed to your own decision.</span>
        <div>
          <span>READ THE CLAIM</span>
          <i aria-hidden="true">→</i>
          <span>CHECK THE RECORD</span>
          <i aria-hidden="true">→</i>
          <span>MAKE YOUR TRADE</span>
        </div>
      </section>
      <section className="landing-section" id="how-it-works">
        <div className="landing-section-heading">
          <p className="eyebrow">01 / Conviction needs context</p>
          <h2>
            Three signals.
            <br />
            No shortcuts.
          </h2>
          <p>
            Identity, stake and performance answer different questions. We put
            them together without pretending they mean the same thing.
          </p>
        </div>
        <div className="landing-features">
          <article>
            <span className="feature-icon" aria-hidden="true">
              ◎
            </span>
            <p className="eyebrow">01 / Identity</p>
            <h3>A person behind the post.</h3>
            <p>
              Prove control of your X account and wallet. Make ownership a
              receipt, not a profile claim.
            </p>
          </article>
          <article>
            <span className="feature-icon" aria-hidden="true">
              ◇
            </span>
            <p className="eyebrow">02 / Stake</p>
            <h3>Put participation onchain.</h3>
            <p>
              A refundable stake is a visible commitment. It stays separate from
              the quality of your predictions.
            </p>
          </article>
          <article>
            <span className="feature-icon" aria-hidden="true">
              ↗
            </span>
            <p className="eyebrow">03 / Evidence</p>
            <h3>Show the whole record.</h3>
            <p>
              Sourced calls, evaluation windows and coverage make performance
              something you can inspect.
            </p>
          </article>
        </div>
      </section>
      <section className="landing-extension">
        <div className="extension-poster" aria-hidden="true">
          <span className="poster-x">𝕏</span>
          <div className="poster-signal">
            ↗{" "}
            <span>
              THE RECORD,
              <br />
              IN YOUR FEED.
            </span>
          </div>
          <span className="poster-bottom">CALL MY BLUFF / X EXTENSION</span>
        </div>
        <div>
          <p className="eyebrow">02 / Meet them where they post</p>
          <h2>
            The conversation
            <br />
            has a new layer.
          </h2>
          <p>
            Look up a creator without leaving the feed. The extension will bring
            identity, stake, and call evidence next to the claim, with
            wallet-approved trading as the next step.
          </p>
          <Link className="button" href="/extension">
            Explore the X extension ↗
          </Link>
          <p className="small-note">
            The development build currently adds evidence links. Live badges and
            trading are in development.
          </p>
        </div>
      </section>
      <section className="landing-section">
        <div className="landing-section-heading">
          <p className="eyebrow">03 / Choose your side of the record</p>
          <h2>
            For the ones who call.
            <br />
            And the ones who check.
          </h2>
        </div>
        <div className="audience-grid">
          <article>
            <span>FOR CREATORS</span>
            <h3>
              Let your record
              <br />
              do the talking.
            </h3>
            <p>
              Prepare your profile, verify ownership, lock a refundable stake
              and make your call history inspectable.
            </p>
            <Link className="text-link" href="/creator">
              Enter the creator studio ↗
            </Link>
          </article>
          <article>
            <span>FOR USERS</span>
            <h3>
              Turn attention
              <br />
              into an informed decision.
            </h3>
            <p>
              Find creators, save handles, review evidence and keep confirmed
              trades in your own portfolio.
            </p>
            <Link className="text-link" href="/dashboard">
              Open your workspace ↗
            </Link>
          </article>
        </div>
      </section>
      <section className="landing-end">
        <p className="eyebrow">The next call deserves a closer look.</p>
        <h2>
          Follow the evidence.
          <br />
          Keep your own conviction.
        </h2>
        <div className="button-row">
          <Link className="button lime-button" href="/terminal">
            Open the terminal ↗
          </Link>
          <Link className="text-link" href="/integrations">
            Explore agent connections ↗
          </Link>
        </div>
        <p className="small-note">
          Frontend foundation · Monad testnet by default · Live data
          integrations in development
        </p>
      </section>
    </div>
  );
}
