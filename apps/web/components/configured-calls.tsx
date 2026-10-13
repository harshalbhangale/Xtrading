"use client";
import {
  identityStatusSchema,
  type PublicCall,
  publicCallLedgerSchema,
} from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { CallLedger, CallSummary } from "./call-ledger";

const errors: Record<string, string> = {
  binding_required: "Bind your X account to a wallet first.",
  x_account_required: "Link your X account first.",
  invalid_call: "Check the call details.",
  invalid_post_url: "Paste a link like https://x.com/you/status/123…",
  post_too_old: "Posts can only be registered within 24 hours of posting.",
  post_not_found: "X could not find that post. It may be private or deleted.",
  post_not_yours: "That post was not written by your bound X account.",
  post_lookup_unavailable: "X could not be reached. Try again shortly.",
  price_unavailable:
    "No price is available for the post time yet. Try again in a few minutes.",
  call_exists: "That post is already registered.",
  call_rate_limited: "You can register up to 10 calls per day.",
  origin_not_allowed: "Open the app at its configured URL.",
  invalid_session: "Your session expired. Sign in again.",
};

export default function ConfiguredCalls() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [handle, setHandle] = useState<string | null | undefined>();
  const [calls, setCalls] = useState<PublicCall[] | null>(null);
  const [form, setForm] = useState({
    postUrl: "",
    asset: "BTC",
    direction: "up",
    horizon: "24h",
    target: "0",
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadCalls = useCallback(async (owner: string) => {
    const response = await fetch(`/api/creators/${owner}/calls`, {
      cache: "no-store",
    });
    const parsed = publicCallLedgerSchema.safeParse(await response.json());
    setCalls(parsed.success ? parsed.data.calls : []);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setHandle(undefined);
    (async () => {
      const token = await getAccessToken();
      const response = await fetch("/api/identity", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const status = identityStatusSchema.parse(await response.json());
      const owner =
        status.bindingCurrent && status.binding ? status.binding.handle : null;
      if (cancelled) return;
      setHandle(owner);
      if (owner) await loadCalls(owner);
    })().catch(() => {
      if (!cancelled) setHandle(null);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, getAccessToken, loadCalls]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!handle) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postUrl: form.postUrl.trim(),
          asset: form.asset,
          direction: form.direction,
          horizon: form.horizon,
          targetBps: Math.max(1, Math.round(Number(form.target) * 100) || 1),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const code =
          typeof result === "object" &&
          result &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "";
        setMessage(errors[code] ?? "Registration failed. Try again.");
        return;
      }
      setMessage("Registered. The entry price is locked in.");
      setForm((f) => ({ ...f, postUrl: "" }));
      await loadCalls(handle);
    } catch {
      setMessage("Registration failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <div className="creator-status">
        <p>Sign in with X to register calls.</p>
        <button type="button" className="button" onClick={login}>
          Sign in
        </button>
      </div>
    );
  if (handle === undefined)
    return <p className="small-note">Checking your account…</p>;
  if (handle === null)
    return (
      <p>
        Bind your X account to a wallet before registering calls.{" "}
        <Link className="text-link" href="/creator/profile">
          Bind account ↗
        </Link>
      </p>
    );
  return (
    <>
      <form className="call-form" onSubmit={(e) => void submit(e)}>
        <label className="call-form-wide">
          Your post on X
          <input
            type="url"
            required
            placeholder={`https://x.com/${handle}/status/…`}
            value={form.postUrl}
            onChange={(e) => setForm({ ...form, postUrl: e.target.value })}
          />
        </label>
        <label>
          Asset
          <select
            value={form.asset}
            onChange={(e) => setForm({ ...form, asset: e.target.value })}
          >
            <option>BTC</option>
            <option>ETH</option>
            <option>SOL</option>
            <option>MON</option>
          </select>
        </label>
        <label>
          Direction
          <select
            value={form.direction}
            onChange={(e) => setForm({ ...form, direction: e.target.value })}
          >
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </label>
        <label>
          By
          <select
            value={form.horizon}
            onChange={(e) => setForm({ ...form, horizon: e.target.value })}
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
          </select>
        </label>
        <label>
          Minimum move
          <select
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
          >
            <option value="0">Any</option>
            <option value="2">2%</option>
            <option value="5">5%</option>
            <option value="10">10%</option>
            <option value="25">25%</option>
          </select>
        </label>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Verifying…" : "Register call"}
        </button>
      </form>
      <p className="small-note">
        The post must be yours and under 24 hours old. Entry is the price when
        you posted; the result uses the price at expiry. Terms can't be edited
        afterwards. {message && <strong role="status">{message}</strong>}
      </p>
      {calls === null ? (
        <p className="small-note">Loading your calls…</p>
      ) : (
        <>
          <CallSummary calls={calls} />
          <CallLedger calls={calls} />
        </>
      )}
    </>
  );
}
