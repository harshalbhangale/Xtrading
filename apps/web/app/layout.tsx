import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Navigation } from "../components/navigation";
import { WalletControl } from "../components/wallet-control";
import "./globals.css";
import "./frontend.css";

export const metadata: Metadata = {
  title: {
    default: "Call My Bluff — conviction has a record",
    template: "%s · Call My Bluff",
  },
  description:
    "Creator reputation, locked stakes, and trading from X on Monad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="topbar">
          <Link href="/" className="wordmark" aria-label="Call My Bluff home">
            <span className="brand-mark" aria-hidden="true">
              ↗
            </span>{" "}
            CALL MY <strong>BLUFF</strong>
            <span className="brand-dot">.</span>
          </Link>
          <Navigation />
          <div className="header-actions">
            <span className="network">
              <i />
              Monad {testnet ? "testnet" : "mainnet"}
            </span>
            <WalletControl />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer>
          <span>
            CALL MY BLUFF <span className="muted">/</span> Put your money where
            your mouth is.
          </span>
          <Link href="/setup">
            Workspace setup <span aria-hidden="true">↗</span>
          </Link>
        </footer>
      </body>
    </html>
  );
}
