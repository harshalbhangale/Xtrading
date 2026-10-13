"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isChromeless } from "./app-routes";

export function SiteFooter(_props: { testnet: boolean }) {
  const path = usePathname();
  if (isChromeless(path)) return null;
  return (
    <footer className="site-footer">
      <span>
        Xtrading · Monad mainnet & testnet · testnet tokens have no monetary
        value
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
