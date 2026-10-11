"use client";
import {
  identityStatusSchema,
  type PublicCreatorEvidence,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { stakeLabel } from "../lib/stake-label";

type Identity = ReturnType<typeof identityStatusSchema.parse>;
type State =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      identity: Identity;
      evidence: PublicCreatorEvidence | null;
    };

export default function ConfiguredCreatorStatus() {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [state, setState] = useState<State>({ kind: "loading" });
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setState({ kind: "loading" });
    (async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("no session");
      const response = await fetch("/api/identity", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("identity unavailable");
      const identity = identityStatusSchema.parse(await response.json());
      let evidence: PublicCreatorEvidence | null = null;
      if (identity.bindingCurrent && identity.binding) {
        const public_ = await fetch(
          `/api/creators/${identity.binding.handle}`,
          { cache: "no-store" },
        );
        if (public_.ok) {
          const parsed = publicCreatorEvidenceSchema.safeParse(
            await public_.json(),
          );
          if (parsed.success) evidence = parsed.data;
        }
      }
      if (!cancelled) setState({ kind: "ready", identity, evidence });
    })().catch(() => {
      if (!cancelled) setState({ kind: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, getAccessToken]);

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <div className="creator-status">
        <p>Sign in with X to see your identity and stake status.</p>
        <button type="button" className="button" onClick={login}>
          Sign in
        </button>
      </div>
    );
  if (state.kind === "loading")
    return <p className="small-note">Checking your account…</p>;
  if (state.kind === "error")
    return (
      <p className="small-note" role="alert">
        Could not load your account status. Refresh to retry.
      </p>
    );

  const { identity, evidence } = state;
  const bound = identity.bindingCurrent && identity.binding;
  const stake = evidence?.stake;
  const staked =
    stake?.status === "active" || stake?.status === "withdrawal-pending";
  const steps = [
    {
      title: "Bind X to a wallet",
      done: Boolean(bound),
      detail: bound
        ? `@${identity.binding?.handle} → ${identity.binding?.wallet.slice(0, 6)}…${identity.binding?.wallet.slice(-4)}`
        : identity.xAccount
          ? `Signed in as @${identity.xAccount.handle}. Sign a wallet proof to bind.`
          : "Link your X account, then sign a wallet proof.",
      href: "/creator/profile",
      action: bound ? "View identity" : "Bind account",
    },
    {
      title: "Lock a refundable stake",
      done: stake?.status === "active",
      detail: !bound
        ? "Available after binding."
        : stake
          ? stakeLabel(stake)
          : "Stake status unavailable.",
      href: "/creator/stake",
      action: staked ? "Manage stake" : "Stake",
    },
    {
      title: "Register calls",
      done: false,
      detail: "Call registration is not live yet.",
      href: "/creator/calls",
      action: "View calls",
    },
  ];
  return (
    <>
      <div className="onboarding-grid">
        {steps.map((step, index) => (
          <article key={step.title}>
            <span className="step-number">0{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <span className="status-badge">{step.done ? "Done" : "To do"}</span>
            <Link className="text-link" href={step.href}>
              {step.action} ↗
            </Link>
          </article>
        ))}
      </div>
      {bound && (
        <p className="small-note">
          Public record:{" "}
          <Link
            className="text-link"
            href={`/creators/${identity.binding?.handle}`}
          >
            /creators/{identity.binding?.handle}
          </Link>
        </p>
      )}
    </>
  );
}
