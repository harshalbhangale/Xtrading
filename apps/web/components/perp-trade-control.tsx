"use client";
import dynamic from "next/dynamic";

const ConfiguredPerpAccount = dynamic(
  () => import("./configured-perp-account"),
  { ssr: false },
);
const ConfiguredPerpTrade = dynamic(() => import("./configured-perp-trade"), {
  ssr: false,
});
export function PerpTradeControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <>
      <ConfiguredPerpAccount />
      <ConfiguredPerpTrade />
    </>
  ) : (
    <p>Privy is not configured. Trading is unavailable.</p>
  );
}
