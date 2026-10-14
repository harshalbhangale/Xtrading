"use client";

import { formatUsd, fromUnits } from "@call-my-bluff/domain";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useState } from "react";

type Position = {
  marketId: number;
  symbol: string;
  priceDecimals: number;
  sizeDecimals: number;
  side: "long" | "short";
  size: string;
  entryPrice: string;
  markPrice: string;
  margin: string;
  unrealizedPnl: string;
};
type Entry = {
  transactionHash: string;
  time: string | null;
  kind: "order" | "deposit" | "withdraw" | "account";
  action: string | null;
  symbol: string | null;
  priceDecimals: number | null;
  sizeDecimals: number | null;
  leverage: number | null;
  filledSize: string;
  averagePrice: string | null;
  fee: string;
  amount: string | null;
  realizedPnl: string | null;
  status: string;
};
type History = {
  wallet: string;
  network: "testnet" | "mainnet";
  explorer: string;
  collateralDecimals: number;
  account: { available: string; locked: string } | null;
  summary: {
    realizedPnl: string;
    unrealizedPnl: string;
    fees: string;
    netPnl: string;
    trades: number;
  };
  positions: Position[];
  history: Entry[];
  method: string;
  observedAt: string;
};

const errors: Record<string, string> = {
  perpl_mainnet_disabled: "Perpl mainnet is switched off on this server.",
  history_unconfigured: "Trade history is not configured on this server.",
  history_unavailable: "Envio HyperSync did not respond. Try again.",
  perpl_unavailable: "Perpl is unavailable. Try again.",
  rate_limited: "Too many requests. Wait a moment.",
};
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const tone = (v: bigint) => (v > 0n ? "pnl-up" : v < 0n ? "pnl-down" : "");
const signed = (v: bigint, d: number) =>
  `${v > 0n ? "+" : ""}${formatUsd(v, d)}`;
const label: Record<string, string> = {
  "open-long": "Open long",
  "open-short": "Open short",
  "close-long": "Close long",
  "close-short": "Close short",
};

/** My trades: Perpl positions, fills and PnL for one of the user's wallets, read from chain. */
export default function ConfiguredPerpHistory() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const owned = wallets.filter(
    (w, i) =>
      (w.linked || w.walletClientType === "privy") &&
      wallets.findIndex(
        (x) => x.address.toLowerCase() === w.address.toLowerCase(),
      ) === i,
  );
  const [selected, setSelected] = useState("");
  const [chainId, setChainId] = useState<10143 | 143>(10143);
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const wallet =
    owned.find((w) => w.address.toLowerCase() === selected.toLowerCase())
      ?.address ??
    owned.find((w) => w.walletClientType !== "privy")?.address ??
    owned[0]?.address;

  const load = useCallback(async () => {
    if (!wallet) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/trades/perp/history?chainId=${chainId}&wallet=${wallet}`,
        { cache: "no-store" },
      );
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        const code = typeof value?.error === "string" ? value.error : "";
        throw new Error(
          errors[code] ?? (code.replaceAll("_", " ") || "Unavailable."),
        );
      }
      setData(value as History);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Unavailable.");
    } finally {
      setLoading(false);
    }
  }, [wallet, chainId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={login}>
        Sign in to see your trades
      </button>
    );
  if (!wallet)
    return (
      <p className="small-note">
        Link a wallet on the Portfolio page to see its trades.
      </p>
    );

  const d = data?.collateralDecimals ?? 6;
  const s = data?.summary;
  return (
    <div className="trades">
      <div className="trades-controls">
        <fieldset className="network-switch" aria-label="Network">
          {(
            [
              [10143, "Testnet"],
              [143, "Mainnet"],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              type="button"
              aria-pressed={chainId === id}
              onClick={() => setChainId(id)}
            >
              {name}
            </button>
          ))}
        </fieldset>
        {owned.length > 1 && (
          <select
            value={wallet}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Wallet"
          >
            {owned.map((w) => (
              <option key={w.address} value={w.address}>
                {short(w.address)} ·{" "}
                {w.walletClientType === "privy"
                  ? "Privy wallet"
                  : w.walletClientType}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="inline-button"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && <p className="form-message">{error}</p>}
      {!data && !error && (
        <p className="small-note">Reading your trades from chain…</p>
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
              <span>Fees paid</span>
              <strong>{formatUsd(BigInt(s.fees), d)}</strong>
            </div>
            <div>
              <span>Perpl balance</span>
              <strong>
                {data.account
                  ? formatUsd(BigInt(data.account.available), d)
                  : "No account"}
              </strong>
            </div>
            <div>
              <span>Filled trades</span>
              <strong>{s.trades}</strong>
            </div>
          </div>

          <h3 className="trades-heading">
            Active positions <small>{data.positions.length}</small>
          </h3>
          {data.positions.length === 0 ? (
            <p className="small-note">
              No open Perpl positions on Monad {data.network}.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="record-table">
                <thead>
                  <tr>
                    <th scope="col">Market</th>
                    <th scope="col">Side</th>
                    <th scope="col">Size</th>
                    <th scope="col">Entry</th>
                    <th scope="col">Mark</th>
                    <th scope="col">Margin</th>
                    <th scope="col">Unrealized PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.positions.map((p) => {
                    const pnl = BigInt(p.unrealizedPnl);
                    return (
                      <tr key={p.marketId}>
                        <td>{p.symbol}-PERP</td>
                        <td>
                          <span className={`side-chip ${p.side}`}>
                            {p.side}
                          </span>
                        </td>
                        <td>
                          {fromUnits(BigInt(p.size), p.sizeDecimals)} {p.symbol}
                        </td>
                        <td>
                          {formatUsd(BigInt(p.entryPrice), p.priceDecimals)}
                        </td>
                        <td>
                          {formatUsd(BigInt(p.markPrice), p.priceDecimals)}
                        </td>
                        <td>{formatUsd(BigInt(p.margin), d)}</td>
                        <td className={tone(pnl)}>{signed(pnl, d)}</td>
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
              No Perpl activity from {short(data.wallet)} on Monad{" "}
              {data.network} yet. Trade from an X post or the Trade page.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="record-table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Action</th>
                    <th scope="col">Market</th>
                    <th scope="col">Size</th>
                    <th scope="col">Price</th>
                    <th scope="col">Fee</th>
                    <th scope="col">Realized</th>
                    <th scope="col">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((e) => {
                    const pnl =
                      e.realizedPnl === null ? null : BigInt(e.realizedPnl);
                    return (
                      <tr key={e.transactionHash}>
                        <td>
                          {e.time
                            ? new Date(e.time).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—"}
                        </td>
                        <td>
                          {e.kind === "order"
                            ? (label[e.action ?? ""] ?? "Order")
                            : e.kind === "deposit"
                              ? "Deposit"
                              : e.kind === "withdraw"
                                ? "Withdraw"
                                : "Open account"}
                          {e.kind === "order" && e.leverage
                            ? ` · ${e.leverage}x`
                            : ""}
                          {e.status !== "filled" && e.status !== "done" && (
                            <small className="trades-status">
                              {" "}
                              {e.status.replace("-", " ")}
                            </small>
                          )}
                        </td>
                        <td>{e.symbol ? `${e.symbol}-PERP` : "AUSD"}</td>
                        <td>
                          {e.kind === "order" && e.sizeDecimals !== null
                            ? fromUnits(BigInt(e.filledSize), e.sizeDecimals)
                            : e.amount
                              ? formatUsd(BigInt(e.amount), d)
                              : "—"}
                        </td>
                        <td>
                          {e.averagePrice && e.priceDecimals !== null
                            ? formatUsd(BigInt(e.averagePrice), e.priceDecimals)
                            : "—"}
                        </td>
                        <td>
                          {e.fee !== "0" ? formatUsd(BigInt(e.fee), d) : "—"}
                        </td>
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
          <p className="small-note">
            {data.method} Updated{" "}
            {new Date(data.observedAt).toLocaleTimeString()} · refreshes every
            30s.
          </p>
        </>
      )}
    </div>
  );
}
