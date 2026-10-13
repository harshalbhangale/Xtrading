"use client";
import { formatUsd, fromUnits } from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { z } from "zod";
import PerpCloseReview from "./perp-close-review";
import { usePerplSteps } from "./use-perpl-steps";
import { useTradingWallet, walletHeader } from "./use-trading-wallet";

const amount = z.string().regex(/^[0-9]+$/);
const schema = z.object({
  wallet: z.string(),
  exchange: z.string(),
  walletCollateral: amount,
  account: z
    .object({
      id: amount,
      available: amount,
      locked: amount,
      frozen: z.boolean(),
    })
    .nullable(),
  positions: z.array(
    z.object({
      marketId: z.number(),
      symbol: z.string(),
      priceDecimals: z.number(),
      sizeDecimals: z.number(),
      side: z.enum(["long", "short"]),
      size: amount,
      entryPrice: amount,
      markPrice: amount,
      collateral: amount,
    }),
  ),
  source: z.string(),
  observedAt: z.string(),
});
const withdrawSchema = z.object({
  wallet: z.string(),
  steps: z
    .array(
      z.object({
        kind: z.literal("withdraw"),
        label: z.string(),
        to: z.custom<`0x${string}`>(
          (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v),
        ),
        data: z.custom<`0x${string}`>(
          (v) => typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v),
        ),
      }),
    )
    .length(1),
});

/** The signed-in user's own Perpl testnet account, read from the Exchange contract. */
export default function ConfiguredPerpAccount() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const tradingWallet = useTradingWallet();
  const runSteps = usePerplSteps();
  const [state, setState] = useState<z.infer<typeof schema> | null>(null);
  const [notice, setNotice] = useState("");
  const [withdraw, setWithdraw] = useState("");
  const [withdrawNotice, setWithdrawNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const load = useCallback(async () => {
    if (!ready || !authenticated) return;
    const who = owner.current;
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/trades/perp/account", {
        headers: {
          Authorization: `Bearer ${token}`,
          ...walletHeader(tradingWallet),
        },
        cache: "no-store",
      });
      if (!r.ok)
        throw new Error(
          r.status === 403
            ? "Connect the wallet you trade with to see your Perpl account."
            : "Perpl account data is unavailable.",
        );
      const value = schema.parse(await r.json());
      if (owner.current === who) {
        setState(value);
        setNotice("");
      }
    } catch (e) {
      if (owner.current === who) {
        setState(null);
        setNotice(e instanceof Error ? e.message : "Account unavailable.");
      }
    }
  }, [ready, authenticated, getAccessToken, tradingWallet]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear private exchange state when the signed-in account changes.
  useEffect(() => {
    setState(null);
    setNotice("");
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => clearInterval(timer);
  }, [load, user?.id]);

  async function withdrawToWallet() {
    const who = owner.current;
    setBusy(true);
    setWithdrawNotice("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/trades/perp/withdraw/prepare", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          ...walletHeader(tradingWallet),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: withdraw.trim() }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error.replaceAll("_", " ")
            : "Withdrawal unavailable.",
        );
      const review = withdrawSchema.parse(data);
      await runSteps(review.wallet, review.steps, (text) => {
        if (owner.current === who) setWithdrawNotice(text);
      });
      if (owner.current !== who) return;
      setWithdraw("");
      setWithdrawNotice("Withdrawn to your wallet. Balances refreshed.");
      void load();
    } catch (e) {
      if (owner.current === who)
        setWithdrawNotice(
          e instanceof Error ? e.message : "Withdrawal failed.",
        );
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) return null;
  if (!state) return <p>{notice || "Loading your Perpl account…"}</p>;
  const ausd = (value: string) => formatUnits(BigInt(value), 6);
  return (
    <section className="dashboard-panel">
      <h2>
        Your Perpl testnet account
        {state.account ? ` · #${state.account.id}` : ""}
      </h2>
      <p>
        Wallet {state.wallet} · {state.source} · Checked {state.observedAt}
      </p>
      {state.account ? (
        <p>
          {ausd(state.account.available)} AUSD available ·{" "}
          {ausd(state.account.locked)} AUSD locked in orders ·{" "}
          {state.account.frozen ? "Frozen" : "Not frozen"}
        </p>
      ) : (
        <p>
          No Perpl account yet. Your first order opens one from your wallet
          (minimum deposit set by Perpl).
        </p>
      )}
      <p>{ausd(state.walletCollateral)} test AUSD in your wallet.</p>
      <p>
        Orders, closes and withdrawals are signed by your own wallet and act
        only on this account. Xtrading holds no Perpl key.
      </p>
      {state.account && (
        <>
          <h3>Open positions ({state.positions.length})</h3>
          {!state.positions.length && <p>No open positions.</p>}
          {state.positions.map((p) => (
            <div key={p.marketId}>
              <p>
                {p.symbol} · {p.side} ·{" "}
                {fromUnits(BigInt(p.size), p.sizeDecimals)} {p.symbol} · Entry{" "}
                {formatUsd(BigInt(p.entryPrice), p.priceDecimals)} · Mark{" "}
                {formatUsd(BigInt(p.markPrice), p.priceDecimals)} ·{" "}
                {ausd(p.collateral)} AUSD collateral
              </p>
              <PerpCloseReview
                marketId={p.marketId}
                onDone={() => void load()}
              />
            </div>
          ))}
          <h3>Withdraw to your wallet</h3>
          <p>
            Closing frees margin into this Perpl account, not your wallet.
            Withdraw free AUSD here; your wallet signs it.
          </p>
          <div className="perp-withdraw">
            <input
              inputMode="decimal"
              maxLength={20}
              placeholder={`Up to ${ausd(state.account.available)}`}
              aria-label="AUSD to withdraw"
              value={withdraw}
              disabled={busy}
              onChange={(e) => setWithdraw(e.target.value)}
            />
            <button
              className="button secondary-button"
              type="button"
              disabled={busy || !withdraw.trim()}
              onClick={() => void withdrawToWallet()}
            >
              {busy ? "Waiting for wallet…" : "Withdraw AUSD"}
            </button>
          </div>
          {withdrawNotice && <p role="status">{withdrawNotice}</p>}
        </>
      )}
    </section>
  );
}
