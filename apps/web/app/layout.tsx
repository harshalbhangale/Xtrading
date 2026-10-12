import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthProvider } from "../components/auth-provider";
import { Brand } from "../components/brand";
import { Navigation } from "../components/navigation";
import { WalletControl } from "../components/wallet-control";
import "./globals.css";
import "./frontend.css";

export const metadata: Metadata = {
  title: {
    default: "Xtrading — conviction has a record",
    template: "%s · Xtrading",
  },
  description:
    "Verified X identity, refundable stake and wallet-approved trading from X, on Monad.",
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
            <Link href="/" className="wordmark" aria-label="Xtrading home">
              <Brand />
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
            <span>Xtrading · Monad {testnet ? "testnet" : "mainnet"}</span>
            <Link href="/setup">System status</Link>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
