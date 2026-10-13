"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useState } from "react";
import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";
import type {
  CallSettlementState,
  PreparedCallRecord,
} from "../lib/call-settlement";
import { useWalletSend } from "./use-wallet-send";

const reasons: Record<string, string> = {
  already_recorded: "Already recorded onchain.",
  call_resolved: "This call has resolved; only open calls can be recorded.",
  asset_not_supported: "Chainlink settlement covers BTC, ETH and SOL only.",
  window_too_short: "Less than an hour remains; recording needs ≥1h.",
  test_mon_required: "Your wallet needs a little testnet MON for gas.",
};
const outcomes = {
  open: "Recorded · Chainlink settles it at expiry",
  success: "Chainlink settled: correct",
  failure: "Chainlink settled: wrong",
  tie: "Chainlink settled: flat",
  refunded: "Not settled (no price)",
} as const;

/**
 * Commits a registered call to the bond-free Chainlink CRE scorecard on Monad
 * testnet. One gas-only transaction; no tokens or approvals.
 */
export function CallRecord({ callId }: { callId: string }) {
  const { getAccessToken } = usePrivy();
  const { sendTransaction } = useWalletSend();
  const [state, setState] = useState<CallSettlementState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function request(method: "GET" | "POST") {
    const token = await getAccessToken();
    if (!token) throw new Error("Your session expired. Sign in again.");
    const response = await fetch(`/api/calls/${callId}/settlement`, {
      method,
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        reasons[value?.error] ??
          String(value?.error ?? "unavailable").replaceAll("_", " "),
      );
    return value;
  }

  async function load() {
    setBusy(true);
    setNotice("");
    try {
      setState((await request("GET")) as CallSettlementState);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function record() {
    setBusy(true);
    setNotice("");
    try {
      const prepared = (await request("POST")) as PreparedCallRecord;
      if (prepared.to.toLowerCase() !== prepared.state.contract.toLowerCase())
        throw new Error("Unexpected transaction target.");
      const { hash } = await sendTransaction(
        {
          chainId: 10143,
          to: prepared.to,
          data: prepared.data as `0x${string}`,
          value: 0n,
          gasLimit: (BigInt(prepared.gas) * 120n) / 100n,
        },
        { address: prepared.wallet, uiOptions: { showWalletUIs: true } },
      );
      setNotice("Submitted; waiting for a receipt…");
      const receipt = await createPublicClient({
        chain: monadTestnet,
        transport: http(),
      }).waitForTransactionReceipt({ hash, confirmations: 2, timeout: 120000 });
      if (receipt.status !== "success")
        throw new Error("Transaction reverted. Nothing was recorded.");
      setState((await request("GET")) as CallSettlementState);
      setNotice(`Recorded in block ${receipt.blockNumber}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Not recorded.");
    } finally {
      setBusy(false);
    }
  }

  if (!state)
    return (
      <div className="call-bond">
        <button
          type="button"
          className="text-link bond-toggle"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Checking…" : "Record on Chainlink"}
        </button>
        {notice && <p className="small-note">{notice}</p>}
      </div>
    );
  return (
    <div className="call-bond">
      {state.onchain ? (
        <p>
          <strong>{outcomes[state.onchain.status]}</strong>
        </p>
      ) : state.recordable ? (
        <>
          <p className="small-note">
            Commits this call to a Chainlink CRE scorecard on Monad testnet.
            Nodes price it at expiry and settle the result onchain. Gas only: no
            tokens, no approval.
          </p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void record()}
          >
            Record on Chainlink
          </button>
        </>
      ) : (
        <p className="small-note">
          {reasons[state.reason ?? ""] ?? "Not recordable."}
        </p>
      )}
      {notice && (
        <p role="status" className="small-note">
          {notice}
        </p>
      )}
    </div>
  );
}
