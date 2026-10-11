"use client";
import dynamic from "next/dynamic";
import Link from "next/link";

const ConfiguredCreatorStatus = dynamic(
  () => import("./configured-creator-status"),
  { ssr: false, loading: () => <p className="small-note">Loading…</p> },
);
export function CreatorStatus() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredCreatorStatus />
  ) : (
    <p className="small-note">
      Sign-in is not configured for this deployment.{" "}
      <Link className="text-link" href="/setup">
        System status
      </Link>
    </p>
  );
}
