"use client";

import { getMonadChain } from "@call-my-bluff/integrations";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { StyleSheetManager } from "styled-components";

// Privy uses this styling prop internally; keep it off native DOM elements.
const forwardWalletProp = (prop: string, target: unknown) =>
  typeof target !== "string" || !["isActive", "isactive"].includes(prop);

export function AuthButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  return (
    <button
      type="button"
      className="button"
      disabled={!ready}
      onClick={() => (authenticated ? void logout() : login())}
    >
      {authenticated ? "Sign out" : "Sign in"}
    </button>
  );
}

export default function ConfiguredWallet({
  appId,
  children,
}: {
  appId: string;
  children: ReactNode;
}) {
  const chain = getMonadChain(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID);
  return (
    <StyleSheetManager shouldForwardProp={forwardWalletProp}>
      <PrivyProvider
        appId={appId}
        config={{
          loginMethods: ["twitter", "email", "wallet"],
          defaultChain: chain,
          supportedChains: [chain],
          appearance: { theme: "light", accentColor: "#a7d83f" },
          embeddedWallets: {
            ethereum: { createOnLogin: "users-without-wallets" },
          },
        }}
      >
        {children}
      </PrivyProvider>
    </StyleSheetManager>
  );
}
