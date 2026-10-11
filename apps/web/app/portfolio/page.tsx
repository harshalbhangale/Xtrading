import Link from "next/link";

export default function PortfolioPage() {
  return (
    <div className="page subpage">
      <p className="eyebrow">03 / Your portfolio</p>
      <h1>
        Your trades.
        <br />
        Their <span className="highlight">story.</span>
      </h1>
      <p className="hero-copy">
        Track fills, holdings, and the posts that led you here.
      </p>
      <div className="section-heading">
        <h2>Trade history</h2>
        <span className="tag">No confirmed fills</span>
      </div>
      <div className="empty-state panel">
        <span className="empty-icon" aria-hidden="true">
          ↗
        </span>
        <h3>Your first trade starts the ledger.</h3>
        <p>
          Confirmed trades will show actual amounts, fees, and their source
          post.
        </p>
        <Link className="text-link" href="/setup">
          Set up your wallet ↗
        </Link>
      </div>
    </div>
  );
}
