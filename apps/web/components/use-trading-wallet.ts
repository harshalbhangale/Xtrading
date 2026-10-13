"use client";
import { useWallets } from "@privy-io/react-auth";

/**
 * The wallet this browser signs with: the first wallet that is actually linked
 * to the login (Privy's embedded wallet or a linked MetaMask). Privy also lists
 * browser wallets that are merely connected to the page; those are not tied to
 * this login, so the server would refuse them. Sent with trading requests so the
 * server acts for the same wallet the user will sign from.
 */
export function useTradingWallet() {
  const { wallets } = useWallets();
  return wallets.find((wallet) => wallet.linked)?.address;
}

export const walletHeader = (
  address: string | undefined,
): Record<string, string> => (address ? { "X-Trading-Wallet": address } : {});
