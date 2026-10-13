"use client";
import dynamic from "next/dynamic";

const ConfiguredTrade = dynamic(() => import("./configured-trade"), {
  ssr: false,
});
export function TradeControl({
  chainId,
  initialParams,
}: {
  chainId: 10143 | 143;
  initialParams?: string;
}) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    // Remount on network change so no review crosses chains.
    <ConfiguredTrade
      key={`${chainId}:${initialParams ?? ""}`}
      chainId={chainId}
      initialParams={initialParams}
    />
  ) : (
    <p>Privy is not configured. Trading is unavailable.</p>
  );
}
