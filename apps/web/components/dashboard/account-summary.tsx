"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

function SignedOut({ audience }: { audience: "user" | "creator" }) {
  return (
    <div className="account-summary">
      <div className="account-summary-text">
        <strong>You’re browsing signed out</strong>
        <span>
          {audience === "creator"
            ? "Sign in with X to bind your account, stake and register calls."
            : "Public records and markets work without an account. Sign in to trade and see your activity."}
        </span>
      </div>
      <Link className="button" href="/start">
        Sign in
      </Link>
    </div>
  );
}

const Configured = dynamic(() => import("./configured-account-summary"), {
  ssr: false,
  loading: () => null,
});

export function AccountSummary({
  audience,
  signedOutPrompt = true,
}: {
  audience: "user" | "creator";
  /** Off where the page already leads with its own sign-in step. */
  signedOutPrompt?: boolean;
}) {
  const fallback = signedOutPrompt ? <SignedOut audience={audience} /> : null;
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <Configured audience={audience} fallback={fallback} />
  ) : (
    fallback
  );
}
