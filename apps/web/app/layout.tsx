import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { AuthProvider } from "../components/auth-provider";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import "./globals.css";
import "./frontend.css";
import "./marketing.css";
import "./motion.css";
import "./app.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Xtrading — conviction has a record",
    template: "%s · Xtrading",
  },
  description:
    "Linked X identity, creator analytics and wallet-approved trading from X, on Monad.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <SiteHeader testnet={testnet} />
          <main id="main">{children}</main>
          <SiteFooter testnet={testnet} />
        </AuthProvider>
      </body>
    </html>
  );
}
