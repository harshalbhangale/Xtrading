"use client";

import { usePrivy } from "@privy-io/react-auth";
import { type ReactNode, useState } from "react";
import { accountLabel } from "./account";
import { Icon } from "./icons";

export default function ConfiguredAccountSummary({
  audience,
  fallback,
}: {
  audience: "user" | "creator";
  fallback: ReactNode;
}) {
  const { ready, authenticated, user } = usePrivy();
  const [copied, setCopied] = useState(false);
  if (!ready) return null;
  if (!authenticated || !user) return fallback;
  const account = accountLabel(user);
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  return (
    <div className="account-summary">
      <span className="account-avatar" aria-hidden="true">
        {account.initial}
      </span>
      <div className="account-summary-text">
        <strong>{account.name}</strong>
        <span>
          {audience === "creator"
            ? "Signed in. Your public record depends on the binding and calls below."
            : "Signed in. Every trade is shown in full before your wallet opens."}
        </span>
      </div>
      <div className="account-facts">
        <span className="fact">
          <i className="signal-dot" aria-hidden="true" />
          {testnet ? "Monad testnet" : "Monad mainnet"}
        </span>
        {account.wallet ? (
          <span className="fact">
            {account.detail}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(account.wallet ?? "")
                  .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
              }}
            >
              <Icon name={copied ? "check" : "copy"} size={15} />
              <span className="sr-only">
                {copied ? "Address copied" : "Copy wallet address"}
              </span>
            </button>
          </span>
        ) : (
          <span className="fact">No wallet connected</span>
        )}
      </div>
    </div>
  );
}
