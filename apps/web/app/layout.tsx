import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthProvider } from "../components/auth-provider";
import { Navigation } from "../components/navigation";
import { WalletControl } from "../components/wallet-control";
import "./globals.css";
import "./frontend.css";

export const metadata: Metadata = {
  title: {
    default: "No More Bluff — conviction has a record",
    template: "%s · No More Bluff",
  },
  description:
    "Creator reputation, locked stakes, and trading from X on Monad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <header className="topbar">
            <Link href="/" className="wordmark" aria-label="No More Bluff home">
              <Image
                src="/brand/no-more-bluff.png"
                alt="No More Bluff"
                width={1774}
                height={887}
                className="brand-logo"
                priority
              />
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
              NO MORE BLUFF <span className="muted">/</span> Put your money
              where your mouth is.
            </span>
            <Link href="/setup">
              Workspace setup <span aria-hidden="true">↗</span>
            </Link>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
