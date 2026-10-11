"use client";
import dynamic from "next/dynamic";

const ConfiguredTrade = dynamic(() => import("./configured-trade"), {
  ssr: false,
});
export function TradeControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredTrade />
  ) : (
    <p>Privy is not configured. Trading is unavailable.</p>
  );
}
