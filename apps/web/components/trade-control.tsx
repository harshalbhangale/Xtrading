"use client";
import dynamic from "next/dynamic";

const ConfiguredTrade = dynamic(() => import("./configured-trade"), {
  ssr: false,
});
export function TradeControl({ chainId }: { chainId: 10143 | 143 }) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    // Remount on network change so no review crosses chains.
    <ConfiguredTrade key={chainId} chainId={chainId} />
  ) : (
    <p>Privy is not configured. Trading is unavailable.</p>
  );
}
