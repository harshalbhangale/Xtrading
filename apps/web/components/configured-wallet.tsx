"use client";

import { getMonadChain } from "@call-my-bluff/integrations";
import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";
import { StyleSheetManager } from "styled-components";

// Privy uses this styling prop internally; keep it off native DOM elements.
const forwardWalletProp = (prop: string, target: unknown) =>
  typeof target !== "string" || !["isActive", "isactive"].includes(prop);

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
          appearance: { theme: "dark", accentColor: "#c6f25a" },
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
