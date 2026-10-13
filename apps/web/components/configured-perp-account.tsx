"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { z } from "zod";
import PerpCloseReview from "./perp-close-review";

const amount = z.string().regex(/^-?[0-9]+$/);
const schema = z.object({
  accountId: z.number(),
  wallet: z.string(),
  availableCollateral: amount,
  forwarding: z.boolean(),
  frozen: z.boolean(),
  source: z.string(),
  observedAt: z.string(),
  markets: z.array(
    z.object({
      marketId: z.number(),
      symbol: z.string(),
      priceDecimals: z.number(),
      sizeDecimals: z.number(),
    }),
  ),
  positions: z.array(
    z.object({
      marketId: z.number(),
      positionId: z.string(),
      side: z.enum(["long", "short"]),
      size: amount,
      entryPrice: amount,
      collateral: amount,
      leverageHundredths: z.number(),
    }),
  ),
  fills: z.array(
    z.object({
      marketId: z.number(),
      requestId: z.number(),
      filledSize: amount,
      fillPrice: amount,
      fee: amount,
      transactionHash: z.string().nullable(),
    }),
  ),
});
export default function ConfiguredPerpAccount() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [state, setState] = useState<z.infer<typeof schema> | null>(null);
  const [notice, setNotice] = useState("");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear private exchange state when the signed-in account changes.
  useEffect(() => {
    let cancelled = false,
      loading = false;
    setState(null);
    setNotice("");
    const load = async () => {
      if (!ready || !authenticated || loading) return;
      loading = true;
      try {
        const token = await getAccessToken();
        const r = await fetch("/api/trades/perp/account", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!r.ok)
          throw new Error(
            r.status === 403
              ? "Exchange account data is available to the configured team operator after wallet binding."
              : "Perpl account data is unavailable.",
          );
        const value = schema.parse(await r.json());
        if (!cancelled) {
          setState(value);
          setNotice("");
        }
      } catch (e) {
        if (!cancelled) {
          setState(null);
          setNotice(e instanceof Error ? e.message : "Account unavailable.");
        }
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, authenticated, user?.id, getAccessToken]);
  if (!authenticated) return null;
  if (!state) return <p>{notice || "Loading Perpl account…"}</p>;
  const market = (id: number) => state.markets.find((m) => m.marketId === id);
  return (
    <section className="dashboard-panel">
      <h2>Perpl testnet · Account #{state.accountId}</h2>
      <p>
        {state.source} · Checked {state.observedAt}
      </p>
      <p>
        {formatUnits(BigInt(state.availableCollateral), 6)} AUSD available ·
        Forwarding {state.forwarding ? "on" : "off"} ·{" "}
        {state.frozen ? "Frozen" : "Not frozen"}
      </p>
      <p>
        Orders execute on this team exchange account. Its collateral is separate
        from your wallet balance.
      </p>
      <h3>Open positions ({state.positions.length})</h3>
      {!state.positions.length && <p>No open positions reported.</p>}
      {state.positions.map((p) => {
        const m = market(p.marketId);
        return (
          <div key={p.positionId}>
            <p>
              {m?.symbol || `Market ${p.marketId}`} · {p.side} · Size{" "}
              {m
                ? formatUnits(BigInt(p.size), m.sizeDecimals)
                : `${p.size} base units`}{" "}
              · Entry{" "}
              {m
                ? formatUnits(BigInt(p.entryPrice), m.priceDecimals)
                : `${p.entryPrice} price units`}{" "}
              · {p.leverageHundredths / 100}x ·{" "}
              {formatUnits(BigInt(p.collateral), 6)} AUSD collateral
            </p>
            <PerpCloseReview positionId={p.positionId} />
          </div>
        );
      })}
      <h3>Recent fills</h3>
      {!state.fills.length && <p>No filled orders reported.</p>}
      {state.fills.map((f) => {
        const m = market(f.marketId);
        return (
          <p key={`${f.requestId}:${f.marketId}`}>
            {m?.symbol || `Market ${f.marketId}`} · Filled{" "}
            {m
              ? formatUnits(BigInt(f.filledSize), m.sizeDecimals)
              : `${f.filledSize} base units`}{" "}
            · Fee {formatUnits(BigInt(f.fee), 6)} AUSD{" "}
            {f.transactionHash && (
              <a
                className="text-link"
                href={`https://testnet.monadvision.com/tx/${f.transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View transaction ↗
              </a>
            )}
          </p>
        );
      })}
      <p>
        Positions are current account state, not proof of which X post caused a
        trade. A close may fill partially: check order status and remaining size
        before another action.
      </p>
      <h3>Withdraw remaining AUSD</h3>
      <p>
        Perpl API keys cannot withdraw. Closing releases remaining margin into
        the exchange account, not your wallet. Use the account owner wallet{" "}
        <code style={{ overflowWrap: "anywhere" }}>{state.wallet}</code> on
        Perpl testnet to approve a withdrawal. This differs from your linked
        Xtrading wallet. Check the recipient and amount before signing, then
        verify the wallet balance and withdrawal receipt.
      </p>
      <a
        className="text-link"
        href="https://testnet.perpl.xyz/"
        target="_blank"
        rel="noreferrer"
      >
        Open official Perpl testnet for withdrawal ↗
      </a>
    </section>
  );
}
