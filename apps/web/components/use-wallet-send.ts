"use client";
import { useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useCallback } from "react";
import { toHex } from "viem";

type Transaction = {
  chainId: number;
  to?: string;
  data: `0x${string}`;
  value: bigint;
  gasLimit: bigint;
};

/**
 * Sends a reviewed transaction from the user's own wallet. Privy embedded
 * wallets use Privy's confirmation UI; external wallets (MetaMask, Rabby…)
 * receive eth_sendTransaction through their own provider and prompt there.
 * Nothing is signed by the server.
 */
export function useWalletSend() {
  const { sendTransaction: sendEmbedded } = useSendTransaction();
  const { wallets } = useWallets();
  const sendTransaction = useCallback(
    async (
      transaction: Transaction,
      options: { address: string; uiOptions?: { showWalletUIs?: boolean } },
    ): Promise<{ hash: `0x${string}` }> => {
      const wallet = wallets.find(
        (w) => w.address.toLowerCase() === options.address.toLowerCase(),
      );
      if (!wallet) throw new Error("Bound wallet is not connected.");
      if (wallet.walletClientType === "privy")
        return sendEmbedded(
          { ...transaction, to: transaction.to as `0x${string}` | undefined },
          options,
        );
      await wallet.switchChain(transaction.chainId);
      const provider = await wallet.getEthereumProvider();
      const hash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address,
            ...(transaction.to ? { to: transaction.to } : {}),
            data: transaction.data,
            value: toHex(transaction.value),
            gas: toHex(transaction.gasLimit),
            chainId: toHex(transaction.chainId),
          },
        ],
      })) as `0x${string}`;
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash))
        throw new Error("Wallet returned no transaction hash.");
      return { hash };
    },
    [sendEmbedded, wallets],
  );
  return { sendTransaction };
}
