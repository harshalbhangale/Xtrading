"use client";
import dynamic from "next/dynamic";
import Link from "next/link";

const ConfiguredIdentity = dynamic(() => import("./configured-identity"), {
  ssr: false,
});
export function IdentityControl({
  serverConfigured,
}: {
  serverConfigured: boolean;
}) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID && serverConfigured ? (
    <ConfiguredIdentity />
  ) : (
    <>
      <p className="small-note">
        Identity verification is unavailable until Privy is configured on the
        server.
      </p>
      <Link className="button secondary-button" href="/setup">
        Set up authentication ↗
      </Link>
    </>
  );
}
