// Illustration for the walkthrough's Discover step. The creator, token, prices and amounts are
// invented. It is not a live post, quote or trade, and it makes no fee or safety claims.
const sparkline =
  "M0 28 L10 24 L18 27 L28 18 L38 21 L46 12 L56 16 L66 7 L76 11 L86 5 L96 9 L106 3 L116 7 L126 2 L140 5 L150 1";

export function TradePostIllustration() {
  return (
    <div className="x-trade-post">
      <div className="x-trade-post-head">
        <span className="x-trade-avatar" aria-hidden="true">
          NC
        </span>
        <span className="x-trade-author">
          Nova Crypto Calls
          <small>@novacryptocalls · 2h</small>
        </span>
      </div>
      <p className="x-trade-text">
        Onchain options are taking off. <b>$VEXO</b> still looks early.
      </p>
      <div className="x-trade-ticket">
        <div className="x-trade-token">
          <span className="x-trade-token-icon" aria-hidden="true">
            V
          </span>
          <span className="x-trade-token-name">
            Vexo
            <small>VEXO · $0.42 · +6.8%</small>
          </span>
          <svg
            className="x-trade-spark"
            viewBox="0 0 150 30"
            aria-hidden="true"
            focusable="false"
          >
            <path d={sparkline} />
          </svg>
        </div>
        <div className="x-trade-toggle" aria-hidden="true">
          <span data-on="true">Buy</span>
          <span>Sell</span>
        </div>
        <div className="x-trade-box">
          <small>You pay</small>
          <strong>100</strong>
          <span>MON</span>
        </div>
        <div className="x-trade-box">
          <small>You receive</small>
          <strong>≈ 238.1</strong>
          <span>VEXO</span>
        </div>
        <span className="x-trade-cta">Review trade</span>
        <p className="x-trade-note">
          Quote and fees are shown before you approve.
        </p>
      </div>
      <p className="x-trade-illustration">
        Illustration · not a live post or quote
      </p>
    </div>
  );
}
