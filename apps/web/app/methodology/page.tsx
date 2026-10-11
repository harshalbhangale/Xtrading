import type { Metadata } from "next";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <div className="page subpage prose-page">
      <h1>How calls are scored</h1>
      <p className="hero-copy">Methodology version directional-return-v1.</p>
      <h2>Registering a call</h2>
      <ul>
        <li>
          A creator who has bound their X account to a wallet pastes the link to
          one of their posts. We confirm through X's public embed service that
          their bound account wrote it, and store the post text.
        </li>
        <li>
          They choose an asset (BTC, ETH, SOL or MON), a direction (up or down),
          a horizon (24 hours, 7 days or 30 days) and an optional minimum move.
        </li>
        <li>
          The post must be registered within 24 hours of being published. Terms
          cannot be changed afterwards. The creator chooses which posts to
          register, so the ledger is not a complete record of their posts.
        </li>
      </ul>
      <h2>Prices</h2>
      <ul>
        <li>
          The price at a given time is the open of the first one-minute candle
          starting at or after that time. If no candle exists within 10 minutes,
          the price is unavailable and the call stays open.
        </li>
        <li>
          BTC, ETH and SOL use Binance spot USDT pairs. MON uses Nansen's price
          for WMON on Monad mainnet.
        </li>
        <li>
          Entry is the price at the post's publication time, taken from the post
          ID. Exit is the price at publication time plus the horizon.
        </li>
        <li>
          Prices are stored as integers with 8 decimals, truncated. No
          floating-point arithmetic is used.
        </li>
      </ul>
      <h2>Outcome</h2>
      <ul>
        <li>
          Correct: the price moved in the called direction by at least the
          minimum move. "Any" means at least 0.01%.
        </li>
        <li>Wrong: it did not. Flat: exit equals entry exactly.</li>
        <li>
          The return shown is the move in the called direction, in basis points
          of the entry price.
        </li>
      </ul>
      <h2>What this is not</h2>
      <p>
        Outcomes are hypothetical. They are not anyone's wallet returns, and a
        refundable stake or a verified identity does not imply good calls.
      </p>
    </div>
  );
}
