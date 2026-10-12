"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { SignedOutActions } from "./signed-out-actions";

export default function ConfiguredHeaderActions() {
  const { ready, authenticated } = usePrivy();
  if (!ready || !authenticated) return <SignedOutActions />;
  return (
    <Link className="xp-button xp-button-small" href="/dashboard">
      Open dashboard <span aria-hidden="true">↗</span>
    </Link>
  );
}
