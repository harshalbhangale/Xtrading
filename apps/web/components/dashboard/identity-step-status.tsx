"use client";
import { identityStatusSchema } from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";

/** Step 01 badge. Reflects server-verified binding only. */
export function IdentityStepStatus() {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [verified, setVerified] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Verified identity must refetch when the signed-in account or linked X account changes.
  useEffect(() => {
    let cancelled = false;
    setVerified(false);
    if (!ready || !authenticated) return;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const response = await fetch("/api/identity", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const parsed = identityStatusSchema.parse(await response.json());
        if (!cancelled) setVerified(Boolean(parsed.bindingCurrent));
      } catch {
        // An unreadable status stays "Not completed"; it never implies a binding.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, user?.id, user?.twitter?.subject, getAccessToken]);

  return (
    <span className="status-badge">
      {verified ? "Completed" : "Not completed"}
    </span>
  );
}
