"use client";
import {
  identityStatusSchema,
  type KolAssessment,
  type PublicCall,
} from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KolFlags, TierLadder, TierProgress } from "./kol-reputation";

type Loaded = {
  handle: string;
  assessment: KolAssessment;
  calls: PublicCall[];
};

/** The signed-in creator's tier, progress bar and (optionally) red flags. */
export default function ConfiguredMyReputation({ full }: { full: boolean }) {
  const { ready, authenticated, login, getAccessToken, user } = usePrivy();
  const [state, setState] = useState<Loaded | "loading" | "unbound" | "error">(
    "loading",
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reload when the signed-in account changes.
  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      const token = await getAccessToken();
      const identity = identityStatusSchema.parse(
        await (
          await fetch("/api/identity", {
            cache: "no-store",
            headers: { Authorization: `Bearer ${token}` },
          })
        ).json(),
      );
      const handle =
        identity.bindingCurrent && identity.binding
          ? identity.binding.handle
          : null;
      if (!handle) {
        if (!cancelled) setState("unbound");
        return;
      }
      const response = await fetch(`/api/creators/${handle}/reputation`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("unavailable");
      const body = (await response.json()) as Omit<Loaded, "handle">;
      if (!cancelled) setState({ handle, ...body });
    })().catch(() => {
      if (!cancelled) setState("error");
    });
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, getAccessToken]);

  if (!ready) return <p className="small-note">Loading…</p>;
  if (!authenticated)
    return (
      <>
        <TierLadder current={null} />
        <button
          type="button"
          className="button"
          onClick={() => login({ loginMethods: ["twitter"] })}
        >
          Sign in with X to track your progress
        </button>
      </>
    );
  if (state === "loading")
    return <p className="small-note">Reading your record…</p>;
  if (state === "error")
    return (
      <p className="small-note" role="alert">
        Your reputation is unavailable right now. Refresh to retry.
      </p>
    );
  if (state === "unbound")
    return (
      <>
        <TierLadder current={null} />
        <p className="small-note">
          Bind your X account to a wallet to start building a record.{" "}
          <Link className="text-link" href="/creator/profile">
            Bind account ↗
          </Link>
        </p>
      </>
    );
  return (
    <>
      <TierProgress assessment={state.assessment} />
      {full && (
        <>
          <h3 className="tier-subheading">All tiers</h3>
          <TierLadder current={state.assessment.tier} />
          <h3 className="tier-subheading">Red flags on your record</h3>
          <KolFlags assessment={state.assessment} calls={state.calls} />
        </>
      )}
      <p className="small-note">
        {state.assessment.scored} scored · {state.assessment.open} open.{" "}
        <Link className="text-link" href={`/creators/${state.handle}`}>
          Public record ↗
        </Link>{" "}
        <Link className="text-link" href="/creator/calls">
          Register a call ↗
        </Link>
      </p>
    </>
  );
}
