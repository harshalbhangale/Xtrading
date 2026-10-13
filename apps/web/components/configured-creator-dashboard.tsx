"use client";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import type { CreatorDashboard } from "../lib/creator-dashboard";
import { TierBadge } from "./kol-reputation";

const explorer = "https://monadvision.com";
const amount = (e: { amount: string; decimals: number; symbol: string }) =>
  `${formatUnits(BigInt(e.amount), e.decimals)} ${e.symbol}`;
const results = {
  open: "Open",
  success: "Correct",
  failure: "Wrong",
  tie: "Flat",
} as const;

/** Earnings summary, payout wallet and per-post analytics for the signed-in creator. */
export default function ConfiguredCreatorDashboard() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [data, setData] = useState<CreatorDashboard | "loading" | string>(
    "loading",
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setData("loading");
    (async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/creator/dashboard", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.json();
      if (cancelled) return;
      setData(
        response.ok
          ? (body as CreatorDashboard)
          : body?.error === "current_binding_required"
            ? "Bind your X account to a wallet to see earnings."
            : "Your dashboard is unavailable right now.",
      );
    })().catch(() => {
      if (!cancelled) setData("Your dashboard is unavailable right now.");
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, getAccessToken]);

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <button
        type="button"
        className="button"
        onClick={() => login({ loginMethods: ["twitter"] })}
      >
        Sign in with X
      </button>
    );
  if (data === "loading")
    return <p className="small-note">Reading your earnings…</p>;
  if (typeof data === "string")
    return (
      <p className="small-note">
        {data}{" "}
        <Link className="text-link" href="/creator/profile">
          Identity ↗
        </Link>
      </p>
    );
  return (
    <div className="creator-dashboard">
      <div className="earn-stats">
        <div>
          <span>Your rate</span>
          <strong>{data.feeBps / 100}% of each buy</strong>
          <TierBadge tier={data.tier} />
        </div>
        <div>
          <span>Earned (confirmed)</span>
          {data.earnings.status === "unavailable" ? (
            <strong>Unavailable</strong>
          ) : data.earnings.totals.length ? (
            data.earnings.totals.map((t) => (
              <strong key={t.symbol}>{amount(t)}</strong>
            ))
          ) : (
            <strong>Nothing yet</strong>
          )}
          <em>
            {data.earnings.paidBuys} paid{" "}
            {data.earnings.paidBuys === 1 ? "buy" : "buys"}
            {data.earnings.status === "lagging" && " · index catching up"}
          </em>
        </div>
        <div>
          <span>Payout wallet</span>
          <a
            href={`${explorer}/address/${data.payoutWallet}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {data.payoutWallet.slice(0, 6)}…{data.payoutWallet.slice(-4)} ↗
          </a>
          <em>
            {data.payoutEnabled
              ? "Fees land here inside each buy. Nothing to withdraw."
              : "Payouts are off. Turn them on below."}
          </em>
        </div>
      </div>
      {!data.feesEnabled && (
        <p className="small-note">
          Creator fees are not switched on for this deployment yet, so buys from
          your posts currently pay no cut.
        </p>
      )}

      <h3 className="tier-subheading">Your posts</h3>
      {data.posts.length === 0 ? (
        <div className="dashboard-empty">
          <h3>No posts tracked yet.</h3>
          <p>
            Register a call, or let extension users surface your posts.{" "}
            <Link className="text-link" href="/creator/calls">
              Register a call ↗
            </Link>
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="record-table">
            <thead>
              <tr>
                <th scope="col">Post</th>
                <th scope="col">Call</th>
                <th scope="col">Result</th>
                <th scope="col">Buys from post</th>
                <th scope="col">You earned</th>
              </tr>
            </thead>
            <tbody>
              {data.posts.map((post) => (
                <tr key={post.postId}>
                  <td className="call-post">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {new Date(post.at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      ↗
                    </a>
                    <p>{post.text || "(no text)"}</p>
                  </td>
                  <td>
                    {post.call
                      ? `${post.call.asset} ${post.call.direction} · ${post.call.horizon}`
                      : post.detected?.asset
                        ? `${post.detected.asset} ${post.detected.direction ?? ""} · detected`
                        : "—"}
                  </td>
                  <td>
                    {post.call ? (
                      <span className={`call-outcome call-${post.call.result}`}>
                        {results[post.call.result]}
                        {post.call.returnBps &&
                          ` ${Number(post.call.returnBps) / 100}%`}
                      </span>
                    ) : (
                      "Not registered"
                    )}
                  </td>
                  <td>
                    {post.buys.mainnet + post.buys.testnet === 0
                      ? "None yet"
                      : `${post.buys.mainnet} mainnet · ${post.buys.testnet} testnet`}
                  </td>
                  <td>
                    {post.earned.length
                      ? post.earned.map((e) => amount(e)).join(" · ")
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.earnings.recent.length > 0 && (
        <>
          <h3 className="tier-subheading">Recent payments</h3>
          <ul className="payment-list">
            {data.earnings.recent.map((p) => (
              <li key={p.transactionHash}>
                <strong>+{amount(p)}</strong>
                <span>
                  {new Date(Number(p.timestamp) * 1000).toUTCString()}
                </span>
                <a
                  href={`${explorer}/tx/${p.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  tx ↗
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="small-note">
        Buys are counted when the buyer's wallet receipt is verified; the post
        link comes from where they bought. Earnings are confirmed Kuru Flow
        payments indexed by Envio.
      </p>
    </div>
  );
}
