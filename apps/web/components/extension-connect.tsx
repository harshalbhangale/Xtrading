"use client";
import dynamic from "next/dynamic";

const ConfiguredExtensionConnect = dynamic(
  () => import("./configured-extension-connect"),
  { ssr: false },
);
export function ExtensionConnect() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? (
    <ConfiguredExtensionConnect />
  ) : (
    <p>Configure Privy to connect the extension.</p>
  );
}
