"use client";
import type { ReactNode } from "react";
import ConfiguredWallet from "./configured-wallet";

// Imported statically so page content still renders on the server; Privy itself
// only initialises in the browser.
export function AuthProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return appId ? (
    <ConfiguredWallet appId={appId}>{children}</ConfiguredWallet>
  ) : (
    children
  );
}
