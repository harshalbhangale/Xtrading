import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "No More Bluff — put conviction on the record",
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
            <Link className="button lime-button" href="/creators">
              Browse creators ↗
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
            <span>NO MORE BLUFF</span>
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
          <p className="eyebrow">How it works</p>
          <h2>Three separate signals.</h2>
          <p>
            Identity, stake and performance answer different questions, so we
            never merge them into one score.
          </p>
        </div>
        <div className="landing-features">
          <article>
            <p className="eyebrow">Identity</p>
            <h3>Who made the call.</h3>
            <p>
              Sign in with X through Privy, then sign a one-time message that
              binds your stable X ID to your wallet.
            </p>
          </article>
          <article>
            <p className="eyebrow">Stake</p>
            <h3>What backs it.</h3>
            <p>
              A refundable deposit in a Monad contract with a seven-day
              withdrawal cooldown. It shows commitment, not accuracy.
            </p>
          </article>
          <article>
            <p className="eyebrow">Record</p>
            <h3>How it played out.</h3>
            <p>
              Calls are tied to their source post and scored under published
              rules. Unscored calls stay visible as unscored.
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
          <span className="poster-bottom">NO MORE BLUFF / X EXTENSION</span>
        </div>
        <div>
          <p className="eyebrow">Chrome extension</p>
          <h2>
            The record,
            <br />
            under the post.
          </h2>
          <p>
            The extension shows a creator's identity binding and stake status
            under their posts on X, with Buy and Sell links that open a
            wallet-reviewed Kuru trade.
          </p>
          <Link className="button" href="/extension">
            Install the extension ↗
          </Link>
        </div>
      </section>
      <section className="landing-section">
        <div className="landing-section-heading">
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
              Bind your X account to a wallet, lock a refundable stake and let
              people inspect your calls.
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
              Look up a creator's record, then trade on Kuru with every amount
              shown before you sign.
            </p>
            <Link className="text-link" href="/dashboard">
              Open your workspace ↗
            </Link>
          </article>
        </div>
      </section>
      <section className="landing-end">
        <h2>
          Follow the evidence.
          <br />
          Keep your own conviction.
        </h2>
        <div className="button-row">
          <Link className="button lime-button" href="/creators">
            Browse creators ↗
          </Link>
        </div>
      </section>
    </div>
  );
}
