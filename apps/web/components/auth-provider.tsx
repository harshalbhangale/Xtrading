"use client";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const ConfiguredProvider = dynamic(() => import("./configured-wallet"), {
  ssr: false,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  return appId ? (
    <ConfiguredProvider appId={appId}>{children}</ConfiguredProvider>
  ) : (
    children
  );
}
