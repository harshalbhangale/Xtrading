"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./app-routes";

export function SiteFooter({ testnet }: { testnet: boolean }) {
  const path = usePathname();
  if (isChromeless(path)) return null;
  return (
    <footer className="site-footer">
      <span>
        Xtrading · Monad {testnet ? "testnet" : "mainnet"}
        {testnet && " · test tokens have no monetary value"}
      </span>
      <nav aria-label="Footer">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/methodology">Methodology</Link>
        <Link href="/extension">Extension</Link>
        <Link href="/setup">System status</Link>
      </nav>
    </footer>
  );
}
