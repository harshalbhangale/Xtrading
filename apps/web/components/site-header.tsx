"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./app-routes";
import { Brand } from "./brand";
import { SignedOutActions } from "./signed-out-actions";

const links = [
  ["/how-it-works", "How it works"],
  ["/for-creators", "For creators"],
  ["/creators", "Creators"],
  ["/extension", "Extension"],
] as const;

const ConfiguredActions = dynamic(() => import("./configured-header-actions"), {
  ssr: false,
  loading: SignedOutActions,
});

export function SiteHeader({ testnet }: { testnet: boolean }) {
  const path = usePathname();
  if (isChromeless(path)) return null;
  return (
    <header className="topbar xp-header">
      <Link href="/" className="wordmark" aria-label="Xtrading home">
        <Brand />
      </Link>
      <nav aria-label="Main navigation">
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="header-actions">
        <span className="network">
          <i />
          Monad {testnet ? "testnet" : "mainnet"}
        </span>
        {process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
          <ConfiguredActions />
        ) : (
          <SignedOutActions />
        )}
      </div>
    </header>
  );
}
