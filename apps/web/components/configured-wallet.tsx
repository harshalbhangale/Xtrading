"use client";

import { getMonadChain } from "@call-my-bluff/integrations";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

function AuthButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  return (
    <button
      type="button"
      className="button"
      disabled={!ready}
      onClick={() => (authenticated ? void logout() : login())}
    >
      {authenticated ? "Disconnect" : "Connect wallet"}
      <span aria-hidden="true">↗</span>
    </button>
  );
}

export default function ConfiguredWallet({ appId }: { appId: string }) {
  const chain = getMonadChain(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID);
  return (
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
      <AuthButton />
    </PrivyProvider>
  );
}
