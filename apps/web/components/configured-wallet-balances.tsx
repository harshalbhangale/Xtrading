"use client";

import { kuruAccountSchema } from "@call-my-bluff/integrations/market-schemas";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";

type Account = ReturnType<typeof kuruAccountSchema.parse>;
const explorer = "https://monadvision.com/address/";

/** The bound wallet's Monad mainnet balances, read from chain at one block. */
export default function ConfiguredWalletBalances() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setAccount(null);
    setError("");
    (async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/trades/account?chainId=143", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("unavailable");
      if (!cancelled) setAccount(kuruAccountSchema.parse(body));
    })().catch(() => {
      if (!cancelled)
        setError(
          "Balances are unavailable. Bind your account and wallet, and check that mainnet is enabled.",
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
        Sign in to see your balances
      </button>
    );
  if (error) return <p className="small-note">{error}</p>;
  if (!account) return <p className="small-note">Reading mainnet balances…</p>;
  return (
    <>
      <p className="small-note">
        Monad mainnet · real funds · block {account.blockNumber} ·{" "}
        <a
          href={`${explorer}${account.wallet}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {account.wallet.slice(0, 6)}…{account.wallet.slice(-4)} ↗
        </a>
      </p>
      <div className="table-scroll">
        <table className="record-table">
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">In your wallet</th>
            </tr>
          </thead>
          <tbody>
            {account.balances.map((row) => (
              <tr key={row.token.address}>
                <td>{row.token.symbol}</td>
                <td>
                  {formatUnits(BigInt(row.wallet), row.token.decimals)}{" "}
                  {row.token.symbol}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small-note">
        Read directly from the chain at this block. Kuru market orders spend
        straight from this wallet, so there is no separate exchange balance.
      </p>
    </>
  );
}
