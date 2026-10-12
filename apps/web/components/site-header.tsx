"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";
import { Navigation } from "./navigation";
import { WalletControl } from "./wallet-control";

export function SiteHeader({ testnet }: { testnet: boolean }) {
  const path = usePathname();
  const marketing = [
    "/",
    "/how-it-works",
    "/for-creators",
    "/extension",
  ].includes(path);
  return (
    <header className={`topbar ${marketing ? "xp-header" : ""}`}>
      <Link href="/" className="wordmark" aria-label="Xtrading home">
        <Brand />
      </Link>
      {marketing ? (
        <nav aria-label="Main navigation">
          {[
            ["/how-it-works", "How it works"],
            ["/for-creators", "For creators"],
            ["/extension", "Extension"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href ?? "/"}
              aria-current={path === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      ) : (
        <Navigation />
      )}
      <div className="header-actions">
        <span className="network">
          <i />
          Monad {testnet ? "testnet" : "mainnet"}
        </span>
        {marketing ? (
          <Link className="xp-button xp-button-small" href="/dashboard">
            Launch app <span>↗</span>
          </Link>
        ) : (
          <WalletControl />
        )}
      </div>
    </header>
  );
}
