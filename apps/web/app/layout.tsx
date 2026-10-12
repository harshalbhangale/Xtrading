import type { Metadata } from "next";
import { Jost } from "next/font/google";
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
    default: "Tradepost — conviction has a record",
    template: "%s · Tradepost",
  },
  description:
    "Verified X identity, refundable stake and wallet-approved trading from X, on Monad.",
};

const brandFont = Jost({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--brand-font",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  return (
    <html lang="en" className={brandFont.variable}>
      <body>
        <AuthProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <header className="topbar">
            <Link href="/" className="wordmark" aria-label="Tradepost home">
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
            <span>Tradepost · Monad {testnet ? "testnet" : "mainnet"}</span>
            <Link href="/setup">System status</Link>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
