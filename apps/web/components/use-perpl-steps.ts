"use client";
import { useCallback } from "react";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import { useWalletSend } from "./use-wallet-send";

export type PerplStep = {
  kind: "approve" | "create-account" | "deposit" | "order" | "withdraw";
  label: string;
  to: `0x${string}`;
  data: `0x${string}`;
};

export const perplClient = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz", { timeout: 15000 }),
});

/**
 * Sends server-reviewed Perpl steps from the user's own wallet, one confirmation
 * each, waiting for every receipt. Returns the hash of each step by kind.
 */
export function usePerplSteps() {
  const { sendTransaction } = useWalletSend();
  return useCallback(
    async (
      wallet: string,
      steps: PerplStep[],
      onProgress: (text: string) => void,
    ) => {
      const hashes: Partial<Record<PerplStep["kind"], `0x${string}`>> = {};
      for (const [index, step] of steps.entries()) {
        onProgress(
          `${step.label} — confirm in your wallet (${index + 1} of ${steps.length})`,
        );
        const gas = await perplClient.estimateGas({
          account: wallet as `0x${string}`,
          to: step.to,
          data: step.data,
        });
        const { hash } = await sendTransaction(
          {
            chainId: 10143,
            to: step.to,
            data: step.data,
            value: 0n,
            gasLimit: (gas * 130n) / 100n,
          },
          { address: wallet, uiOptions: { showWalletUIs: true } },
        );
        onProgress(`${step.label} — waiting for confirmation…`);
        const receipt = await perplClient.waitForTransactionReceipt({
          hash,
          timeout: 120000,
        });
        if (receipt.status !== "success")
          throw new Error(`${step.label} reverted. Nothing further was sent.`);
        hashes[step.kind] = hash;
      }
      return hashes;
    },
    [sendTransaction],
  );
}
