"use client";
import { useWallets } from "@privy-io/react-auth";

/**
 * The wallet this browser is signing with (Privy's active wallet: MetaMask or
 * the embedded one). Sent with trading requests so the server acts for the same
 * wallet the user will sign from; the server checks it is linked to the login.
 */
export function useTradingWallet() {
  const { wallets } = useWallets();
  return wallets[0]?.address;
}

export const walletHeader = (
  address: string | undefined,
): Record<string, string> => (address ? { "X-Trading-Wallet": address } : {});
