"use client";
import {
  type CallBondState,
  callBondStateSchema,
  preparedCallBondSchema,
} from "@call-my-bluff/domain";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { monadTestnet } from "viem/chains";
import { price } from "./call-ledger";
import { useWalletSend } from "./use-wallet-send";

type Prepared = ReturnType<typeof preparedCallBondSchema.parse>;
const reasons: Record<string, string> = {
  already_bonded: "Already bonded.",
  call_resolved: "This call has resolved; only open calls can be bonded.",
  asset_not_bondable: "Chainlink settlement covers BTC, ETH and SOL only.",
  window_too_short: "Less than an hour remains; bonded windows need ≥1h.",
};
const outcomes: Record<string, string> = {
  open: "Bonded · awaiting Chainlink settlement",
  success: "Settled correct · bond + reward claimable",
  failure: "Settled wrong · bond slashed",
  tie: "Settled flat · bond returned",
  refunded: "Refunded (no price available)",
};
const usdc = (units: string) => formatUnits(BigInt(units), 6);
const time = (seconds: string) =>
  new Date(Number(seconds) * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

/** Owner-only recovery for previously funded calls. New call bonds are retired. */
export function CallBond({ callId }: { callId: string }) {
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useWalletSend();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CallBondState | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function request(body?: unknown) {
    const token = await getAccessToken();
    if (!token) throw new Error("Your session expired. Sign in again.");
    const response = await fetch(`/api/calls/${callId}/bond`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        typeof value.error === "string"
          ? (reasons[value.error] ?? value.error.replaceAll("_", " "))
          : "Bond service unavailable.",
      );
    return value;
  }

  async function refresh() {
    setPrepared(null);
    try {
      setState(callBondStateSchema.parse(await request()));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unavailable.");
    }
  }

  async function prepare(action: "claim" | "refund") {
    setBusy(true);
    setPrepared(null);
    setNotice("");
    try {
      const value = preparedCallBondSchema.parse(await request({ action }));
      setState(value.state);
      setPrepared(value);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Preparation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const transaction = prepared;
    if (!transaction || Date.parse(transaction.expiresAt) <= Date.now()) {
      setPrepared(null);
      setNotice("Review expired. Prepare again.");
      return;
    }
    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === transaction.wallet.toLowerCase(),
    );
    if (!wallet) {
      setNotice("Bound wallet is not connected.");
      return;
    }
    setBusy(true);
    setPrepared(null);
    try {
      await wallet.switchChain(10143);
      const { hash } = await sendTransaction(
        {
          chainId: 10143,
          to: transaction.to,
          data: transaction.data as `0x${string}`,
          value: 0n,
          gasLimit: (BigInt(transaction.gas) * 120n) / 100n,
        },
        { address: transaction.wallet, uiOptions: { showWalletUIs: true } },
      );
      setNotice(`Submitted ${hash.slice(0, 10)}…; waiting for a receipt.`);
      const receipt = await createPublicClient({
        chain: monadTestnet,
        transport: http(),
      }).waitForTransactionReceipt({ hash, confirmations: 2, timeout: 120000 });
      if (receipt.status !== "success")
        throw new Error("Transaction reverted. Nothing changed.");
      await refresh();
      setNotice(
        transaction.action === "approve"
          ? `Allowance confirmed in block ${receipt.blockNumber}. Prepare the bond next.`
          : `${transaction.action === "register" ? "Bond" : transaction.action} confirmed in block ${receipt.blockNumber}.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Transaction rejected or unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open)
    return (
      <button
        type="button"
        className="text-link bond-toggle"
        onClick={() => {
          setOpen(true);
          void refresh();
        }}
      >
        Recover previous call funds
      </button>
    );
  return (
    <div className="call-bond">
      {!state ? (
        <p className="small-note">{notice || "Reading the contract…"}</p>
      ) : (
        <>
          {state.onchain ? (
            <p>
              <strong>{outcomes[state.onchain.status]}</strong>
              <br />
              {usdc(state.onchain.bond)} mUSDC bond ·{" "}
              {usdc(state.onchain.reward)} reward
              <br />
              <span className="muted">
                Window {time(state.onchain.start)} →{" "}
                {time(state.onchain.expiry)}
                {state.onchain.status !== "open" &&
                  state.onchain.status !== "refunded" &&
                  ` · ${price(state.onchain.entryPrice, 8)} → ${price(state.onchain.exitPrice, 8)}`}
              </span>
            </p>
          ) : (
            <p className="small-note">
              No previous call deposit found. New call bonds are disabled.
            </p>
          )}
          {BigInt(state.claimable) > 0n && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void prepare("claim")}
            >
              Claim {usdc(state.claimable)} mUSDC
            </button>
          )}
          {state.refundableAt &&
            BigInt(state.blockTimestamp) >= BigInt(state.refundableAt) && (
              <button
                type="button"
                className="button secondary-button"
                disabled={busy}
                onClick={() => void prepare("refund")}
              >
                Refund unsettled bond
              </button>
            )}
        </>
      )}
      {prepared && (
        <div className="bond-review">
          <p>
            <strong>
              {prepared.action === "approve"
                ? `Step 1 of 2 · allow exactly ${usdc(prepared.bond ?? "0")} mUSDC`
                : prepared.action === "register"
                  ? `Step 2 of 2 · bond ${usdc(prepared.bond ?? "0")} mUSDC`
                  : prepared.action === "claim"
                    ? `Claim ${usdc(prepared.state.claimable)} mUSDC`
                    : "Refund bond"}
            </strong>
            <br />
            <span className="muted">
              To {prepared.to} · gas {prepared.gas} · Monad testnet
            </span>
          </p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            Confirm in wallet
          </button>{" "}
          <button
            type="button"
            className="button secondary-button"
            disabled={busy}
            onClick={() => setPrepared(null)}
          >
            Cancel
          </button>
        </div>
      )}
      {state && notice && (
        <p role="status" className="small-note">
          {notice}
          {busy ? " Working…" : ""}
        </p>
      )}
    </div>
  );
}
