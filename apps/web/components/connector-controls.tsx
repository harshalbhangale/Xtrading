"use client";
import dynamic from "next/dynamic";
import { useState } from "react";

/** A value with a one-click copy button. */
export function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy-text">
      <code>{value}</code>
      <button
        type="button"
        className="inline-button"
        onClick={() =>
          void navigator.clipboard
            .writeText(value)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {})
        }
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

const ConfiguredDisconnect = dynamic(
  () => import("./configured-connector-disconnect"),
  { ssr: false, loading: () => null },
);
export function ConnectorDisconnect() {
  return process.env.NEXT_PUBLIC_PRIVY_APP_ID ? <ConfiguredDisconnect /> : null;
}
