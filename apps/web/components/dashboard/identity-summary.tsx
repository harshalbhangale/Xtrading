"use client";
import { identityStatusSchema } from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { MetricCard } from "./ui";

type IdentityStatus = ReturnType<typeof identityStatusSchema.parse>;

/** Live identity card. Stake, reputation and indexed calls stay unconnected. */
export function IdentitySummary() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [status, setStatus] = useState<IdentityStatus | null>(null);
  const [failed, setFailed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Verified identity must refetch when the signed-in account or linked X account changes.
  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setFailed(false);
    if (!ready || !authenticated) return;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("no session");
        const response = await fetch("/api/identity", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error("identity unavailable");
        const parsed = identityStatusSchema.parse(await response.json());
        if (!cancelled) setStatus(parsed);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, user?.twitter?.subject, getAccessToken]);

  const verified = Boolean(status?.bindingCurrent && status.binding);
  return (
    <MetricCard
      label="Identity"
      icon="◎"
      value={verified ? `@${status?.xAccount?.handle ?? ""}` : "Unlinked"}
      detail={identityDetail({ ready, authenticated, failed, verified })}
    />
  );
}

function identityDetail({
  ready,
  authenticated,
  failed,
  verified,
}: {
  ready: boolean;
  authenticated: boolean;
  failed: boolean;
  verified: boolean;
}) {
  if (!ready) return "Checking verified identity";
  if (!authenticated) return "Sign in to check verified ownership";
  if (failed) return "Could not load verified identity";
  if (verified) return "X and wallet ownership verified";
  return "X ownership has not been verified";
}
