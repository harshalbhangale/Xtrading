"use client";
import dynamic from "next/dynamic";

const ConfiguredPerpAccount = dynamic(
  () => import("./configured-perp-account"),
  { ssr: false },
);
const ConfiguredPerpTrade = dynamic(() => import("./configured-perp-trade"), {
  ssr: false,
});
export function PerpTradeControl({
  chainId = 10143,
}: {
  chainId?: 10143 | 143;
}) {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <>
      <ConfiguredPerpAccount key={`account:${chainId}`} chainId={chainId} />
      <ConfiguredPerpTrade key={`trade:${chainId}`} chainId={chainId} />
    </>
  ) : (
    <p>Privy is not configured. Trading is unavailable.</p>
  );
}
