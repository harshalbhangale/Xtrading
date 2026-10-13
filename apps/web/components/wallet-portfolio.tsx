"use client";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { z } from "zod";

const units = z.string().regex(/^[0-9]+$/);
const token = z.object({
  symbol: z.string(),
  decimals: z.number(),
  amount: units,
});
const overview = z.object({
  wallet: z.string(),
  observedAt: z.string(),
  balances: z.array(token),
  historyStatus: z.enum(["current", "partial", "unavailable"]),
  windowBlocks: z.number(),
  historySource: z.string(),
  transactions: z.array(
    z.object({
      hash: z.string(),
      status: z.enum(["success", "reverted"]),
      time: z.string(),
      label: z.string(),
      value: units,
      nativeDirection: z.enum(["in", "out"]),
      transfers: z.array(
        token.extend({ id: z.string(), direction: z.enum(["in", "out"]) }),
      ),
    }),
  ),
});
export default function WalletHistory({
  wallet,
}: {
  wallet: string | undefined;
}) {
  const [data, setData] = useState<z.infer<typeof overview> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    if (!wallet) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/wallet/overview?address=${wallet}`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error("Wallet data is temporarily unavailable.");
        const value = overview.parse(await r.json());
        if (!cancelled) setData(value);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Wallet unavailable");
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [wallet]);
  if (!wallet) return null;
  if (error) return <p role="status">{error}</p>;
  if (!data) return <p>Loading recent transactions…</p>;
  return (
    <>
      {" "}
      {data && (
        <section className="dashboard-panel">
          <h2>Recent transactions</h2>
          <p>
            Direct wallet transactions in the last{" "}
            {data.windowBlocks.toLocaleString()} blocks. Internal transfers and
            older history are not included.
          </p>
          {data.historyStatus === "unavailable" ? (
            <p>
              Transaction history is temporarily unavailable. Your live balances
              above are still available.
            </p>
          ) : !data.transactions.length ? (
            <p>No transactions found in this recent window.</p>
          ) : (
            <div className="table-scroll">
              <table className="record-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Wallet movement</th>
                    <th>Status</th>
                    <th>Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((t) => (
                    <tr key={t.hash}>
                      <td>{new Date(t.time).toLocaleString()}</td>
                      <td>{t.label}</td>
                      <td>
                        {BigInt(t.value) > 0n &&
                          `${formatUnits(BigInt(t.value), 18)} MON ${t.nativeDirection === "out" ? "sent" : "received"}`}{" "}
                        {t.transfers.map((transfer) => (
                          <div key={transfer.id}>
                            {transfer.direction === "out" ? "−" : "+"}
                            {formatUnits(
                              BigInt(transfer.amount),
                              transfer.decimals,
                            )}{" "}
                            {transfer.symbol}
                          </div>
                        ))}
                      </td>
                      <td>{t.status}</td>
                      <td>
                        <a
                          className="text-link"
                          href={`https://monadvision.com/tx/${t.hash}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small-note">
            {data.historySource} · Checked {data.observedAt}
            {data.historyStatus === "partial"
              ? " · Partial history; recent transactions may be missing."
              : ""}
          </p>
        </section>
      )}
    </>
  );
}
