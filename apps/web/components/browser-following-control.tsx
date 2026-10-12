"use client";
import dynamic from "next/dynamic";

const BrowserFollowing = dynamic(() => import("./browser-following"), {
  ssr: false,
});
export function BrowserFollowingControl() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <BrowserFollowing />
  ) : (
    <p>Sign-in is not configured.</p>
  );
}
