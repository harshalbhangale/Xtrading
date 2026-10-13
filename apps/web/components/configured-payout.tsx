"use client";
import { amountSchema, creatorFeeBpsSchema } from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatUnits, zeroAddress } from "viem";
import { z } from "zod";

const schema = z.object({
  xUserId: z.string(),
  handle: z.string(),
  wallet: z.string(),
  enabled: z.boolean(),
  version: z.number().nullable(),
  mainnetFeesEnabled: z.boolean(),
  bps: creatorFeeBpsSchema,
});
const earningsSchema = z.object({
  source: z.string().optional(),
  progressBlock: z.string().nullable().optional(),
  status: z.enum(["unavailable", "current", "lagging"]),
  payments: z.array(
    z.object({
      id: z.string(),
      token: z.string(),
      amount: amountSchema,
      transactionHash: z.string(),
      timestamp: amountSchema,
    }),
  ),
});
type Registration = z.infer<typeof schema>;
export default function ConfiguredPayout() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [record, setRecord] = useState<Registration | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [earnings, setEarnings] = useState<z.infer<
    typeof earningsSchema
  > | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear private payout state when the signed-in user changes.
  useEffect(() => {
    let cancelled = false;
    setRecord(null);
    setEarnings(null);
    setNotice("");
    let loading = false;
    const load = async () => {
      if (!ready || !authenticated || loading) return;
      loading = true;
      try {
        const token = await getAccessToken();
        const r = await fetch("/api/creator/payout", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok)
          throw new Error(
            "Link your X account and prove wallet ownership before registering payouts.",
          );
        const data = schema.parse(await r.json());
        if (!cancelled) setRecord(data);
        const er = await fetch("/api/creator/earnings", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (er.ok) {
          const ev = earningsSchema.safeParse(await er.json());
          if (ev.success && !cancelled) setEarnings(ev.data);
        }
      } catch (e) {
        if (!cancelled)
          setNotice(e instanceof Error ? e.message : "Account unavailable.");
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [ready, authenticated, getAccessToken, user?.id]);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  async function save() {
    const who = owner.current;
    if (!record) return;
    setBusy(true);
    setNotice("");
    try {
      const token = await getAccessToken();
      const r = await fetch("/api/creator/payout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: !record.enabled }),
      });
      if (!r.ok) throw new Error("Payout registration could not be saved.");
      const updated = schema.parse(await r.json());
      if (owner.current !== who) return;
      setRecord(updated);
      setNotice("Registration saved. This is not a trade or token approval.");
    } catch (e) {
      if (owner.current === who)
        setNotice(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p>Loading account…</p>;
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
  return (
    <div className="stake-form">
      {earnings && (
        <p>
          {earnings.source || "Envio"} · {earnings.status} · Block{" "}
          {earnings.progressBlock || "unavailable"}.{" "}
          <Link href="/dashboard/onchain">View onchain evidence ↗</Link>
        </p>
      )}
      {record && (
        <>
          <p>
            <strong>@{record.handle}</strong> · X account linked
          </p>
          <p>
            Payout wallet: <code>{record.wallet}</code>
          </p>
          <p>
            Your cut: {record.bps / 100}% of each Monad mainnet buy made from
            your posts, set by your tier (0.1% verified, 0.5% Pro, 1% Max, 2%
            Ultra). Paid straight to this wallet inside the buy; the buyer sees
            it before signing. No deposit, nothing to withdraw.
          </p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void save()}
          >
            {record.enabled
              ? "Disable creator payouts"
              : "Enable creator payouts"}
          </button>
          <p className="small-note">
            {record.mainnetFeesEnabled
              ? "Fee-enabled trading is available for registered creators."
              : "Registration is available; fee-enabled execution is switched off until deployment checks pass."}
          </p>
          <h3>Confirmed Kuru Flow payments</h3>
          <p className="small-note">
            {!earnings || earnings.status === "unavailable"
              ? "Payment history unavailable. The fee indexer is not connected or could not be verified."
              : earnings.status === "lagging"
                ? "Indexer catching up. These are recorded payments; the list may be incomplete."
                : earnings.payments.length === 0
                  ? "No confirmed payments in the indexed window."
                  : "Latest recorded payments, checked against canonical blocks."}{" "}
            Registration and quoted fees are not payment evidence. Source-post
            attribution remains unverified.
          </p>
          {earnings?.payments.map((payment) => (
            <p key={payment.id}>
              {payment.token === zeroAddress
                ? `${formatUnits(BigInt(payment.amount), 18)} MON`
                : `${payment.amount} raw units · ${payment.token}`}{" "}
              ·{" "}
              <a
                href={`https://monadvision.com/tx/${payment.transactionHash}`}
                target="_blank"
                rel="noreferrer"
              >
                View payment ↗
              </a>
            </p>
          ))}
        </>
      )}
      <p role="status">{notice}</p>
      <Link className="text-link" href="/creator/profile">
        Manage X and wallet binding ↗
      </Link>
    </div>
  );
}
