"use client";
import { type KuruActivity, kuruActivitySchema } from "@call-my-bluff/domain";
import { kuruUsdc, kuruV2 } from "@call-my-bluff/integrations/kuru";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

const decimals = { USDC: kuruUsdc.decimals, WETH: 18, WBTC: 8 } as const;
const explorer = "https://testnet.monadvision.com/tx/";
const amount = (value: string, symbol: keyof typeof decimals) =>
  `${formatUnits(BigInt(value), decimals[symbol])} ${symbol}`;
const time = (seconds: string) =>
  new Date(Number(seconds) * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
// Execution price in USDC per base, from integer amounts (display only).
function price(swap: KuruActivity["swaps"][number]) {
  const base = kuruV2.markets[swap.market].base.decimals;
  const [quote, size] =
    swap.side === "buy"
      ? [BigInt(swap.amountIn), BigInt(swap.amountOut)]
      : [BigInt(swap.amountOut), BigInt(swap.amountIn)];
  if (size === 0n) return "—";
  const cents = (quote * 10n ** BigInt(base) * 100n) / (size * 10n ** 6n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export default function ConfiguredActivity({
  view,
}: {
  view: "fills" | "all";
}) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [activity, setActivity] = useState<KuruActivity | null>(null);
  const [error, setError] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setActivity(null);
    setError("");
    (async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/me/activity", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("unavailable");
      if (!cancelled) setActivity(kuruActivitySchema.parse(body));
    })().catch(() => {
      if (!cancelled)
        setError("Activity is unavailable. Bind your account and retry.");
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, getAccessToken]);

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={login}>
        Sign in to see your trades
      </button>
    );
  if (error) return <p className="small-note">{error}</p>;
  if (!activity) return <p className="small-note">Loading confirmed fills…</p>;

  const status =
    activity.status === "current"
      ? `Envio index current at block ${activity.progressBlock} (chain head ${activity.headBlock}, unfinalized).`
      : activity.status === "lagging"
        ? `Envio index is behind: block ${activity.progressBlock} of ${activity.headBlock}. Recent fills may be missing.`
        : "Envio index unavailable. Fills cannot be shown right now; this is not an empty history.";
  return (
    <>
      <p className="small-note">{status}</p>
      {activity.swaps.length === 0 ? (
        <div className="dashboard-empty">
          <h3>No confirmed fills yet.</h3>
          <p>
            {activity.status === "unavailable"
              ? "Fill history is unavailable."
              : "Fills appear here once a Kuru swap from your wallet is confirmed and indexed."}
          </p>
          <Link className="text-link" href="/dashboard/trade">
            Trade ↗
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="record-table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Market</th>
                <th scope="col">Spent</th>
                <th scope="col">Received</th>
                <th scope="col">Price</th>
                <th scope="col">Source post</th>
                <th scope="col">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {activity.swaps.map((swap) => {
                const base = swap.market;
                const [inSymbol, outSymbol] =
                  swap.side === "buy"
                    ? (["USDC", base] as const)
                    : ([base, "USDC"] as const);
                return (
                  <tr key={swap.id}>
                    <td>{time(swap.timestamp)}</td>
                    <td>
                      {swap.side === "buy" ? "Buy" : "Sell"} {base}/USDC
                    </td>
                    <td>{amount(swap.amountIn, inSymbol)}</td>
                    <td>{amount(swap.amountOut, outSymbol)}</td>
                    <td>{price(swap)} USDC</td>
                    <td>
                      {swap.sourcePostId ? (
                        <a
                          href={`https://x.com/i/status/${swap.sourcePostId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {swap.sourcePostId} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <a
                        href={`${explorer}${swap.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Block {swap.blockNumber} ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {view === "all" && activity.transfers.length > 0 && (
        <>
          <h3>Deposits and withdrawals</h3>
          <div className="table-scroll">
            <table className="record-table">
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Event</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {activity.transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td>{time(transfer.timestamp)}</td>
                    <td>
                      {transfer.kind === "deposit"
                        ? "Deposit to Kuru"
                        : "Withdrawal to wallet"}
                    </td>
                    <td>{amount(transfer.amount, transfer.token)}</td>
                    <td>
                      <a
                        href={`${explorer}${transfer.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Block {transfer.blockNumber} ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="small-note">
        Amounts come from confirmed SpotSwap events indexed by Envio, fees
        included. Source posts are what you entered when trading; they are not
        verified. These are your actual fills, separate from any creator's call
        outcomes.
      </p>
    </>
  );
}
