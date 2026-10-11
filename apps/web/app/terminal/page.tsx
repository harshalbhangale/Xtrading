import Link from "next/link";
import { CreatorSearch } from "../../components/creator-search";

export default function TerminalPage() {
  return (
    <div className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">
            <span className="signal-dot" /> The conviction terminal
          </p>
          <h1>
            Big claims.
            <br />
            Real <span className="highlight">receipts.</span>
          </h1>
          <p className="hero-copy">
            See the record behind the recommendation.
            <br />
            Follow the evidence. Make your own trade.
          </p>
        </div>
        <div className="hero-aside">
          <span className="issue-number">01 / MONAD</span>
          <div className="abstract-mark" aria-hidden="true">
            ↗
          </div>
          <p>
            Reputation. Stake. Execution.
            <br />
            <span className="muted">One place to connect the dots.</span>
          </p>
        </div>
      </section>
      <CreatorSearch />
      <section className="terminal-grid">
        <div className="feed">
          <div className="section-heading">
            <div>
              <p className="eyebrow">01 / Public record</p>
              <h2>The call feed</h2>
            </div>
            <span className="tag">Awaiting first call</span>
          </div>
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              ⌁
            </span>
            <h3>A record starts with a call.</h3>
            <p>
              Indexed predictions and their supporting evidence will appear
              here.
            </p>
            <Link href="/creators" className="text-link">
              Explore creator records ↗
            </Link>
          </div>
          <div className="ledger-key">
            <span>
              <i className="key-square" />
              Identity linked
            </span>
            <span>
              <i className="key-circle" />
              Stake locked
            </span>
            <span>
              <i className="key-line" />
              Evidence available
            </span>
          </div>
        </div>
        <aside className="right-column">
          <div className="pledge-card">
            <p className="eyebrow">For creators</p>
            <h2>
              Back your
              <br />
              words.
            </h2>
            <p>
              Link your X account. Lock a stake. Give your audience a record
              they can inspect.
            </p>
            <Link className="button light-button" href="/creator">
              Create your record ↗
            </Link>
            <div className="pledge-note">
              Identity and stake are shown separately from performance.
            </div>
          </div>
          <div className="principle-card">
            <p className="eyebrow">The standard</p>
            <ol>
              <li>
                <span>01</span> Identity you can check.
              </li>
              <li>
                <span>02</span> Stake you can see.
              </li>
              <li>
                <span>03</span> Calls you can review.
              </li>
            </ol>
          </div>
        </aside>
      </section>
    </div>
  );
}
