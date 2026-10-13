"use client";
import dynamic from "next/dynamic";

const ConfiguredStake = dynamic(() => import("./configured-stake"), {
  ssr: false,
});
export function StakeControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredStake />
  ) : (
    <p>Sign-in is required to recover a previous deposit.</p>
  );
}
