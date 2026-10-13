"use client";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useRef, useState } from "react";
import {
  type Address,
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  http,
  parseAbi,
} from "viem";
import { monadTestnet } from "viem/chains";
import { useWalletSend } from "./use-wallet-send";

const faucet = "0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C" as const;
const token = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC" as const;
const abi = parseAbi(["function requestFunds(address recipient)"]);
const client = createPublicClient({
  chain: monadTestnet,
  transport: http("https://testnet-rpc.monad.xyz", { timeout: 15000 }),
});

export default function ConfiguredAusdFaucet() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useWalletSend();
  // Any wallet linked to this login: the Privy wallet or a linked MetaMask.
  const linked = wallets.filter(
    (item, index) =>
      (item.linked || item.walletClientType === "privy") &&
      wallets.findIndex(
        (other) => other.address.toLowerCase() === item.address.toLowerCase(),
      ) === index,
  );
  const [selected, setSelected] = useState("");
  const wallet =
    linked.find(
      (item) => item.address.toLowerCase() === selected.toLowerCase(),
    ) ??
    linked.find((item) => item.walletClientType !== "privy") ??
    linked[0];
  const owner = useRef(wallet?.address);
  owner.current = authenticated ? wallet?.address : undefined;
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState<`0x${string}` | null>(null);

  async function claim() {
    if (!wallet || !authenticated || locked.current) return;
    locked.current = true;
    setBusy(true);
    setHash(null);
    setNotice("");
    const recipient = wallet.address as Address;
    const sameUser = () =>
      owner.current?.toLowerCase() === recipient.toLowerCase();
    try {
      await wallet.switchChain(10143);
      if (!sameUser()) return;
      if ((await client.getChainId()) !== 10143)
        throw new Error("RPC network mismatch.");
      const [before, gas, gasPrice, nativeBalance] = await Promise.all([
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [recipient],
        }),
        client.estimateContractGas({
          address: faucet,
          abi,
          functionName: "requestFunds",
          args: [recipient],
          account: recipient,
        }),
        client.getGasPrice(),
        client.getBalance({ address: recipient }),
      ]);
      await client.simulateContract({
        address: faucet,
        abi,
        functionName: "requestFunds",
        args: [recipient],
        account: recipient,
      });
      const gasLimit = (gas * 120n) / 100n;
      if (nativeBalance < gasLimit * gasPrice)
        throw new Error("Add testnet MON for gas before claiming.");
      if (!sameUser()) return;
      const sent = await sendTransaction(
        {
          chainId: 10143,
          to: faucet,
          data: encodeFunctionData({
            abi,
            functionName: "requestFunds",
            args: [recipient],
          }),
          value: 0n,
          gasLimit,
        },
        { address: recipient, uiOptions: { showWalletUIs: true } },
      );
      if (sameUser()) {
        setHash(sent.hash);
        setNotice("Submitted. Waiting for confirmation…");
      }
      const receipt = await client.waitForTransactionReceipt({
        hash: sent.hash,
        confirmations: 2,
        timeout: 120000,
      });
      if (receipt.status !== "success")
        throw new Error("Claim reverted. No successful claim was recorded.");
      const after = await client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [recipient],
      });
      if (sameUser())
        setNotice(
          `Claim confirmed. Wallet balance: ${formatUnits(after, 6)} test AUSD (change: ${formatUnits(after - before, 6)}). This is wallet collateral, not a Perpl account deposit.`,
        );
    } catch (error) {
      if (sameUser())
        setNotice(
          error instanceof Error
            ? error.message
            : "Claim unavailable. Check wallet and faucet status.",
        );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  if (!ready) return <p>Loading wallet…</p>;
  if (!authenticated)
    return (
      <button type="button" onClick={login}>
        Sign in to claim
      </button>
    );
  if (!wallet)
    return (
      <p>
        Link a wallet on the Portfolio page (Privy wallet or MetaMask) to claim.
        No private key is needed.
      </p>
    );
  return (
    <>
      {linked.length > 1 ? (
        <label>
          Receiving wallet:{" "}
          <select
            value={wallet.address}
            disabled={busy}
            onChange={(event) => setSelected(event.target.value)}
          >
            {linked.map((item) => (
              <option key={item.address} value={item.address}>
                {item.address} ·{" "}
                {item.walletClientType === "privy"
                  ? "Privy wallet"
                  : item.walletClientType}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>
          Receiving wallet: <code>{wallet.address}</code>
        </p>
      )}
      <p>
        Network: Monad testnet · 10143. Native value: 0 MON; gas is paid in test
        MON.
      </p>
      <p>
        Faucet: <code>{faucet}</code>
      </p>
      <p>
        Perpl collateral token: <code>{token}</code>
      </p>
      <p>
        This requests faucet tokens for your own wallet. It creates no token
        approval and places no trade. Availability and claim limits are checked
        by simulation before your wallet opens.
      </p>
      <button type="button" disabled={busy} onClick={() => void claim()}>
        {busy ? "Claim in progress…" : "Request test AUSD · review in wallet"}
      </button>
      <p role="status">{notice}</p>
      {hash && (
        <a
          href={`https://testnet.monadvision.com/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View claim transaction ↗
        </a>
      )}
    </>
  );
}
