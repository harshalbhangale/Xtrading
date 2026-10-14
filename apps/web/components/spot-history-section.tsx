"use client";

import { formatUsd, fromUnits } from "@call-my-bluff/domain";
import { useCallback, useEffect, useState } from "react";

type Holding = {
  market: string;
  symbol: string;
  baseDecimals: number;
  amount: string;
  averageCost: string;
  costBasis: string;
  markPrice: string | null;
  value: string | null;
  unrealizedPnl: string | null;
};
type Entry = {
  transactionHash: string;
  time: string | null;
  symbol: string;
  baseDecimals: number;
  side: "buy" | "sell";
  baseAmount: string;
  quoteAmount: string;
  price: string | null;
  realizedPnl: string | null;
};
type SpotHistory = {
  wallet: string;
  network: "testnet" | "mainnet";
  explorer: string;
  quoteDecimals: number;
  summary: {
    realizedPnl: string;
    unrealizedPnl: string;
    netPnl: string;
    trades: number;
  };
  holdings: Holding[];
  history: Entry[];
  method: string;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const tone = (v: bigint) => (v > 0n ? "pnl-up" : v < 0n ? "pnl-down" : "");
const signed = (v: bigint, d: number) =>
  `${v > 0n ? "+" : ""}${formatUsd(v, d)}`;
/** Token amounts at a readable precision; full precision stays on chain. */
const amount = (v: string, decimals: number) => {
  const [whole, fraction = ""] = fromUnits(BigInt(v), decimals).split(".");
  return fraction ? `${whole}.${fraction.slice(0, 6)}` : whole;
};

/** Kuru spot buys and sells for one wallet, with average-cost PnL, read from chain. */
export function SpotHistorySection({
  wallet,
  chainId,
  refreshKey,
}: {
  wallet: string;
  chainId: 10143 | 143;
  refreshKey: number;
}) {
  const [data, setData] = useState<SpotHistory | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(
        `/api/trades/spot/history?chainId=${chainId}&wallet=${wallet}`,
        { cache: "no-store" },
      );
      const value = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof value?.error === "string"
            ? value.error.replaceAll("_", " ")
            : "Unavailable.",
        );
      setData(value as SpotHistory);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Unavailable.");
    }
  }, [wallet, chainId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey re-runs the read on demand.
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load, refreshKey]);

  const d = data?.quoteDecimals ?? 6;
  const s = data?.summary;
  return (
    <section className="trades-section" aria-label="Kuru spot">
      <h3 className="trades-title">Kuru spot</h3>
      {error && <p className="form-message">{error}</p>}
      {!data && !error && (
        <p className="small-note">Reading your Kuru trades from chain…</p>
      )}
      {data && s && (
        <>
          <div className="trades-summary">
            <div>
              <span>Net PnL</span>
              <strong className={tone(BigInt(s.netPnl))}>
                {signed(BigInt(s.netPnl), d)}
              </strong>
            </div>
            <div>
              <span>Unrealized</span>
              <strong className={tone(BigInt(s.unrealizedPnl))}>
                {signed(BigInt(s.unrealizedPnl), d)}
              </strong>
            </div>
            <div>
              <span>Realized</span>
              <strong className={tone(BigInt(s.realizedPnl))}>
                {signed(BigInt(s.realizedPnl), d)}
              </strong>
            </div>
            <div>
              <span>Spot trades</span>
              <strong>{s.trades}</strong>
            </div>
          </div>

          <h3 className="trades-heading">
            Holdings from these trades <small>{data.holdings.length}</small>
          </h3>
          {data.holdings.length === 0 ? (
            <p className="small-note">
              Nothing held from Kuru buys on Monad {data.network}.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="record-table">
                <thead>
                  <tr>
                    <th scope="col">Token</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Avg cost</th>
                    <th scope="col">Price now</th>
                    <th scope="col">Value</th>
                    <th scope="col">Unrealized PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holdings.map((h) => {
                    const pnl =
                      h.unrealizedPnl === null ? null : BigInt(h.unrealizedPnl);
                    return (
                      <tr key={h.market}>
                        <td>{h.symbol}</td>
                        <td>{amount(h.amount, h.baseDecimals)}</td>
                        <td>{formatUsd(BigInt(h.averageCost), d)}</td>
                        <td>
                          {h.markPrice
                            ? formatUsd(BigInt(h.markPrice), d)
                            : "—"}
                        </td>
                        <td>{h.value ? formatUsd(BigInt(h.value), d) : "—"}</td>
                        <td className={pnl === null ? "" : tone(pnl)}>
                          {pnl === null ? "No price" : signed(pnl, d)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="trades-heading">
            History <small>{data.history.length}</small>
          </h3>
          {data.history.length === 0 ? (
            <p className="small-note">
              No Kuru trades from {short(data.wallet)} on Monad {data.network}{" "}
              yet. Buy from an X post or the Trade page.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="record-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Side</th>
                    <th scope="col">Token</th>
                    <th scope="col">Amount</th>
                    <th scope="col">USDC</th>
                    <th scope="col">Price</th>
                    <th scope="col">Realized</th>
                    <th scope="col">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((e) => {
                    const pnl =
                      e.realizedPnl === null ? null : BigInt(e.realizedPnl);
                    return (
                      <tr key={`${e.transactionHash}-${e.symbol}`}>
                        <td>
                          {e.time
                            ? new Date(e.time).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td>
                          <span
                            className={`side-chip ${e.side === "buy" ? "long" : "short"}`}
                          >
                            {e.side}
                          </span>
                        </td>
                        <td>{e.symbol}</td>
                        <td>{amount(e.baseAmount, e.baseDecimals)}</td>
                        <td>{formatUsd(BigInt(e.quoteAmount), d)}</td>
                        <td>{e.price ? formatUsd(BigInt(e.price), d) : "—"}</td>
                        <td className={pnl === null ? "" : tone(pnl)}>
                          {pnl === null ? "—" : signed(pnl, d)}
                        </td>
                        <td>
                          <a
                            className="text-link"
                            href={`${data.explorer}/tx/${e.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {short(e.transactionHash)} ↗
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="small-note">{data.method}</p>
        </>
      )}
    </section>
  );
}
