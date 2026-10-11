"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

const ConfiguredWallet = dynamic(
  () => import("./configured-wallet").then((module) => module.AuthButton),
  {
    ssr: false,
    loading: () => (
      <button type="button" className="button" disabled>
        Sign in
      </button>
    ),
  },
);

export function WalletControl() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return appId ? (
    <ConfiguredWallet />
  ) : (
    <Link className="button" href="/setup">
      Sign in
    </Link>
  );
}
