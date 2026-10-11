"use client";

import { useState } from "react";

export function TradeTicket({
  marketName,
  marketAddress,
  chainName,
}: {
  marketName: string;
  marketAddress: string;
  chainName: string;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  return (
    <div className="stake-form">
      <fieldset className="preview-selector" aria-label="Trade side">
        <button
          type="button"
          aria-pressed={side === "buy"}
          onClick={() => setSide("buy")}
        >
          Buy
        </button>
        <button
          type="button"
          aria-pressed={side === "sell"}
          onClick={() => setSide("sell")}
        >
          Sell
        </button>
      </fieldset>
      <label htmlFor="trade-market">Market deployment reference</label>
      <select id="trade-market" disabled>
        <option>
          {marketName} · {chainName}
        </option>
      </select>
      <p>
        Market parameters and liquidity have not been verified. This reference
        is not an executable quote.
      </p>
      <label htmlFor="trade-amount">
        {side === "buy"
          ? "Quote token amount to spend"
          : "Base token amount to sell"}
      </label>
      <input
        id="trade-amount"
        inputMode="decimal"
        value={amount}
        onChange={(event) => {
          if (/^[0-9]*\.?[0-9]*$/.test(event.target.value))
            setAmount(event.target.value);
        }}
        placeholder="0.00"
        maxLength={80}
      />
      <p>
        This is a display amount only. Verified token decimals are required
        before creating integer transaction amounts.
      </p>
      <button className="button" type="button" disabled>
        Quote unavailable
      </button>
      <details className="market-details">
        <summary>Inspect the venue reference</summary>
        <p>Kuru · {chainName}</p>
        <code>{marketAddress}</code>
      </details>
    </div>
  );
}
