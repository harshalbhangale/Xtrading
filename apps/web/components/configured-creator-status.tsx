"use client";
import {
  identityStatusSchema,
  publicCallLedgerSchema,
} from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";

type Identity = ReturnType<typeof identityStatusSchema.parse>;
type State =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      identity: Identity;
      calls: number | null;
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
      let calls: number | null = null;
      if (identity.bindingCurrent && identity.binding) {
        const handle = identity.binding.handle;
        const ledger = await fetch(`/api/creators/${handle}/calls`, {
          cache: "no-store",
        });
        if (ledger.ok) {
          const parsed = publicCallLedgerSchema.safeParse(await ledger.json());
          if (parsed.success) calls = parsed.data.calls.length;
        }
      }
      if (!cancelled) setState({ kind: "ready", identity, calls });
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
      <Checklist
        steps={[
          {
            title: "Bind X to a wallet",
            done: false,
            detail: "Sign in with X, then sign a wallet proof.",
            href: "/start",
            action: "Sign in with X",
          },
          {
            title: "Register calls",
            done: false,
            detail: "Available after binding.",
            href: "/creator/calls",
            action: "Register a call",
          },
        ]}
        onSignIn={() => login({ loginMethods: ["twitter"] })}
      />
    );
  if (state.kind === "loading")
    return <p className="small-note">Checking your account…</p>;
  if (state.kind === "error")
    return (
      <p className="small-note" role="alert">
        Could not load your account status. Refresh to retry.
      </p>
    );

  const { identity, calls } = state;
  const bound = identity.bindingCurrent && identity.binding;
  const steps: Step[] = [
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
      title: "Register calls",
      done: Boolean(calls),
      detail: !bound
        ? "Available after binding."
        : calls === null
          ? "Call ledger unavailable."
          : calls === 0
            ? "Register a prediction from one of your posts within 24 hours of posting."
            : `${calls} registered.`,
      href: "/creator/calls",
      action: calls ? "View calls" : "Register a call",
    },
  ];
  return (
    <>
      <Checklist steps={steps} />
      {bound && (
        <p className="small-note">
          Your public record:{" "}
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

type Step = {
  title: string;
  done: boolean;
  detail: string;
  href: string;
  action: string;
};

function Checklist({
  steps,
  onSignIn,
}: {
  steps: Step[];
  onSignIn?: () => void;
}) {
  const complete = steps.filter((step) => step.done).length;
  const next = steps.findIndex((step) => !step.done);
  return (
    <>
      <div className="setup-progress">
        <span>
          {complete} of {steps.length} complete
        </span>
        <div
          className="progress-bar"
          role="progressbar"
          aria-label="Creator setup"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={complete}
        >
          <span style={{ width: `${(complete / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="setup-steps">
        {steps.map((step, index) => {
          const primary = index === next;
          const className = primary ? "button" : "button secondary-button";
          return (
            <li className="setup-step" data-done={step.done} key={step.title}>
              <span className="step-marker" aria-hidden="true">
                {step.done ? "✓" : index + 1}
              </span>
              <div>
                <h3>
                  {step.title}
                  <span className="sr-only">
                    {step.done ? " (done)" : " (to do)"}
                  </span>
                </h3>
                <p>{step.detail}</p>
              </div>
              {primary && onSignIn ? (
                <button type="button" className={className} onClick={onSignIn}>
                  {step.action}
                </button>
              ) : (
                <Link className={className} href={step.href}>
                  {step.action}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
