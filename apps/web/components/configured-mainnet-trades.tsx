"use client";

import { type MainnetTrades, mainnetTradesSchema } from "@call-my-bluff/domain";
import { kuruMainnet, kuruMainnetUsdc } from "@call-my-bluff/integrations/kuru";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

const explorer = "https://monadvision.com/tx/";
const usdcSymbol = "USDC";
const time = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Amount spent for a verified trade, in the input token's units. */
function tradeAmounts(trade: MainnetTrades["trades"][number]) {
  const key = trade.market as keyof typeof kuruMainnet.markets | null;
  if (!trade.verified || !key || !trade.side || !trade.inputAmount) return null;
  const base = kuruMainnet.markets[key].base;
  const buy = trade.side === "buy";
  const shown = (value: string, decimals: number, symbol: string) =>
    `${formatUnits(BigInt(value), decimals)} ${symbol}`;
  return {
    label: `${buy ? "Buy" : "Sell"} ${key}/${usdcSymbol}`,
    spent: buy
      ? shown(trade.inputAmount, kuruMainnetUsdc.decimals, usdcSymbol)
      : shown(trade.inputAmount, base.decimals, base.symbol),
  };
}

export default function ConfiguredMainnetTrades() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [result, setResult] = useState<MainnetTrades | null>(null);
  const [error, setError] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setResult(null);
    setError("");
    (async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/me/mainnet-trades", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("unavailable");
      if (!cancelled) setResult(mainnetTradesSchema.parse(body));
    })().catch(() => {
      if (!cancelled)
        setError(
          "Mainnet trades are unavailable. Bind your account and retry.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, getAccessToken]);

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={login}>
        Sign in to see mainnet trades
      </button>
    );
  if (error) return <p className="small-note">{error}</p>;
  if (!result) return <p className="small-note">Checking mainnet receipts…</p>;
  if (result.status === "unavailable")
    return (
      <div className="dashboard-empty">
        <h3>Mainnet trades are unavailable.</h3>
        <p>
          {result.reason === "mainnet_trading_disabled"
            ? "Mainnet trading is switched off on this server. Trades made on mainnet appear here once it is on."
            : "Mainnet trade history cannot be checked right now. This is not an empty history."}
        </p>
      </div>
    );
  if (result.trades.length === 0)
    return (
      <div className="dashboard-empty">
        <h3>No mainnet trades recorded yet.</h3>
        <p>
          Trades you make on mainnet from a post appear here once confirmed.
        </p>
        <Link className="text-link" href="/dashboard/trade">
          Trade ↗
        </Link>
      </div>
    );
  return (
    <>
      <p className="small-note">
        Each trade is checked against its transaction and receipt on Monad
        mainnet. Amounts are what you spent; amounts received are not indexed
        yet. Source posts are what you entered; they are not verified.
      </p>
      <div className="table-scroll">
        <table className="record-table">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Trade</th>
              <th scope="col">Spent</th>
              <th scope="col">Source post</th>
              <th scope="col">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {result.trades.map((trade) => {
              const shown = tradeAmounts(trade);
              return (
                <tr key={trade.transactionHash}>
                  <td>{time(trade.recordedAt)}</td>
                  <td>{shown?.label ?? "Receipt not verified"}</td>
                  <td>{shown?.spent ?? "—"}</td>
                  <td>
                    <a
                      href={`https://x.com/i/status/${trade.sourcePostId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {trade.sourcePostId} ↗
                    </a>
                  </td>
                  <td>
                    <a
                      href={`${explorer}${trade.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {trade.blockNumber
                        ? `Block ${trade.blockNumber} ↗`
                        : "View ↗"}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
