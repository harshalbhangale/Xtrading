import { type Address, getAddress, type Hex } from "viem";
import { WalletError, walletRequest } from "./wallet";

const MONAD_TESTNET = {
  chainId: "0x279f",
  chainName: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadvision.com"],
};

export type PerplWalletStep = {
  kind: "approve" | "create-account" | "deposit" | "order";
  label: string;
  to: Address;
  data: Hex;
};

async function ensureMonadTestnet() {
  if ((await walletRequest<string>("eth_chainId")) === MONAD_TESTNET.chainId)
    return;
  try {
    await walletRequest("wallet_switchEthereumChain", [
      { chainId: MONAD_TESTNET.chainId },
    ]);
  } catch (error) {
    if (!(error instanceof WalletError) || error.code !== 4902) throw error;
    await walletRequest("wallet_addEthereumChain", [MONAD_TESTNET]);
  }
  if ((await walletRequest<string>("eth_chainId")) !== MONAD_TESTNET.chainId)
    throw new Error("Switch your wallet to Monad testnet.");
}

async function sendAndWait(from: Address, step: PerplWalletStep) {
  const hash = await walletRequest<Hex>(
    "eth_sendTransaction",
    [{ from, to: step.to, data: step.data, value: "0x0" }],
    300000,
  );
  for (let i = 0; i < 120; i++) {
    const receipt = await walletRequest<{ status: string } | null>(
      "eth_getTransactionReceipt",
      [hash],
    );
    if (receipt) {
      if (receipt.status !== "0x1")
        throw new Error(`${step.label} reverted. Nothing further was sent.`);
      return hash;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Still pending: ${hash}`);
}

/**
 * Sends the reviewed Perpl steps from the user's own browser wallet, one
 * confirmation each. The wallet must be the bound one: the order trades that
 * wallet's own Perpl account and is read back against the binding.
 */
export async function signPerplSteps(input: {
  wallet: string;
  steps: PerplWalletStep[];
  onStatus: (text: string) => void;
}): Promise<Hex> {
  input.onStatus("Connect your wallet…");
  const [account] = await walletRequest<string[]>("eth_requestAccounts");
  if (!account) throw new Error("No wallet account connected.");
  const from = getAddress(account);
  const bound = getAddress(input.wallet);
  if (from !== bound)
    throw new Error(
      `Your browser wallet is ${from.slice(0, 6)}…${from.slice(-4)}, but your Xtrading wallet is ${bound.slice(0, 6)}…${bound.slice(-4)}. Switch accounts, or finish in the app.`,
    );
  input.onStatus("Checking network…");
  await ensureMonadTestnet();
  let orderHash: Hex | null = null;
  for (const [index, step] of input.steps.entries()) {
    input.onStatus(
      `${step.label} — confirm in your wallet (${index + 1} of ${input.steps.length})…`,
    );
    const hash = await sendAndWait(from, step);
    if (step.kind === "order") orderHash = hash;
  }
  if (!orderHash) throw new Error("No order step was sent.");
  return orderHash;
}
