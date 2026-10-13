"use client";
import { preparedStakeSchema, stakeStateSchema } from "@call-my-bluff/domain";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { monadTestnet } from "viem/chains";
import { useWalletSend } from "./use-wallet-send";

type State = ReturnType<typeof stakeStateSchema.parse>;
type Prepared = ReturnType<typeof preparedStakeSchema.parse>;
export default function ConfiguredStake() {
  const { ready, authenticated, getAccessToken, user, login, logout } =
    usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useWalletSend();
  const [state, setState] = useState<State | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;
  const request = useCallback(
    async (path: string, body?: unknown) => {
      const token = await getAccessToken();
      if (!token) {
        setSessionExpired(true);
        throw new Error(
          "Your session expired. Sign in again before preparing a transaction.",
        );
      }
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const value = await response.json();
      if (response.status === 401) {
        setSessionExpired(true);
        throw new Error(
          "Your session expired. Sign in again before preparing a transaction.",
        );
      }
      if (!response.ok)
        throw new Error(
          typeof value.error === "string"
            ? value.error.replaceAll("_", " ")
            : "Stake service unavailable.",
        );
      setSessionExpired(false);
      return value;
    },
    [getAccessToken],
  );
  const refresh = useCallback(async () => {
    const owner = activeUser.current;
    setPrepared(null);
    setState(null);
    setNotice("");
    try {
      const value = stakeStateSchema.parse(await request("/api/stake"));
      if (activeUser.current === owner) setState(value);
    } catch (error) {
      if (activeUser.current === owner)
        setNotice(
          error instanceof Error ? error.message : "Stake unavailable.",
        );
    }
  }, [request]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear private state and refresh when the signed-in account changes.
  useEffect(() => {
    setState(null);
    setPrepared(null);
    setHash(null);
    if (ready && authenticated) void refresh();
  }, [ready, authenticated, user?.id, refresh]);
  async function prepare(action: string) {
    const owner = activeUser.current;
    setBusy(true);
    setPrepared(null);
    setNotice("");
    try {
      const value = preparedStakeSchema.parse(
        await request("/api/stake/prepare", {
          action,
        }),
      );
      const displayState = stakeStateSchema.parse(await request("/api/stake"));
      if (
        displayState.wallet !== value.state.wallet ||
        displayState.contract !== value.state.contract ||
        displayState.token !== value.state.token
      )
        throw new Error(
          "Wallet or deployment changed. Refresh and prepare again.",
        );
      if (activeUser.current === owner) {
        setPrepared(value);
        setState(displayState);
      }
    } catch (error) {
      if (activeUser.current === owner)
        setNotice(
          error instanceof Error ? error.message : "Preparation failed.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!prepared || Date.parse(prepared.expiresAt) <= Date.now()) {
      setPrepared(null);
      setNotice("Review expired. Prepare a fresh transaction.");
      return;
    }
    const transaction = prepared,
      owner = activeUser.current;
    const wallet = wallets.find(
      (w) => w.address.toLowerCase() === transaction.wallet.toLowerCase(),
    );
    if (!wallet) {
      setNotice("Bound wallet is not connected.");
      return;
    }
    setBusy(true);
    setPrepared(null);
    setHash(null);
    try {
      // Refresh and verify authentication immediately before opening wallet approval.
      // Never retry a signing/submission call automatically after a token error.
      const current = stakeStateSchema.parse(await request("/api/stake"));
      if (
        current.wallet.toLowerCase() !== transaction.wallet.toLowerCase() ||
        current.contract !== transaction.state.contract ||
        current.token.toLowerCase() !== transaction.state.token.toLowerCase()
      )
        throw new Error(
          "Wallet or deployment changed. Refresh and prepare again.",
        );
      await wallet.switchChain(10143);
      if (activeUser.current !== owner)
        throw new Error("Account changed. Prepare again.");
      if (Date.parse(transaction.expiresAt) <= Date.now())
        throw new Error("Review expired. Prepare again.");
      const { hash: sent } = await sendTransaction(
        {
          chainId: 10143,
          ...(transaction.to ? { to: transaction.to } : {}),
          data: transaction.data as `0x${string}`,
          value: 0n,
          gasLimit: (BigInt(transaction.gas) * 120n) / 100n,
        },
        { address: transaction.wallet, uiOptions: { showWalletUIs: true } },
      );
      if (activeUser.current !== owner) return;
      setHash(sent);
      setNotice(
        "Submitted. Waiting for an onchain receipt; the withdrawal action is not confirmed yet.",
      );
      const client = createPublicClient({
        chain: monadTestnet,
        transport: http(),
      });
      const receipt = await client.waitForTransactionReceipt({
        hash: sent,
        confirmations: 2,
        timeout: 120000,
      });
      if (activeUser.current !== owner) return;
      if (receipt.status !== "success")
        throw new Error(
          "Transaction reverted. No successful action is claimed.",
        );
      await refresh();
      setNotice(
        `${transaction.action} confirmed in block ${receipt.blockNumber}. Latest chain state is unfinalized.`,
      );
    } catch (error) {
      if (activeUser.current === owner) {
        const message = error instanceof Error ? error.message : "";
        if (
          /invalid.?auth.?token|expired.?token|token.?expired|exp.*claim.*timestamp/i.test(
            message,
          )
        ) {
          setSessionExpired(true);
          setNotice(
            "Wallet authentication expired. Sign in again, refresh chain state and prepare a new review. No transaction is retried automatically.",
          );
        } else
          setNotice(
            message ||
              "Transaction rejected or unavailable. Refresh before retrying.",
          );
      }
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p>Loading wallet session…</p>;
  if (!authenticated)
    return (
      <button className="button" type="button" onClick={() => login()}>
        Sign in to recover a previous deposit
      </button>
    );
  const pending = !!state?.contract && state.withdrawableAt !== "0";
  const hasBalance = !!state?.contract && BigInt(state.balance) > 0n;
  const unlocked =
    pending &&
    state != null &&
    BigInt(state.blockTimestamp) >= BigInt(state.withdrawableAt);
  return (
    <div className="sk">
      <button
        className="button secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void refresh()}
      >
        Refresh
      </button>
      {(notice || busy) && (
        <p role="status">
          {notice}
          {busy ? " Working…" : ""}
        </p>
      )}
      {sessionExpired && (
        <button
          className="button secondary-button"
          type="button"
          onClick={async () => {
            setState(null);
            setPrepared(null);
            setHash(null);
            await logout();
            login();
          }}
        >
          Sign in again
        </button>
      )}
      {state && (
        <>
          <dl className="evidence-list">
            <dt>Bound wallet</dt>
            <dd>{state.wallet}</dd>
            <dt>Previous deposit</dt>
            <dd>
              {state.contract
                ? `${formatUnits(BigInt(state.balance), 6)} ${state.symbol}`
                : "No recovery contract configured"}
            </dd>
            <dt>Withdrawal unlock</dt>
            <dd>
              {pending
                ? new Date(
                    Number(BigInt(state.withdrawableAt) * 1000n),
                  ).toUTCString()
                : "No withdrawal request"}
            </dd>
            <dt>Network</dt>
            <dd>Monad testnet (10143); test tokens have no monetary value</dd>
          </dl>
          {hasBalance && (
            <div className="sk-withdraw">
              <button
                className="button secondary-button"
                type="button"
                disabled={busy || pending}
                onClick={() => void prepare("requestWithdrawal")}
              >
                Request withdrawal
              </button>
              <button
                className="button secondary-button"
                type="button"
                disabled={busy || !pending}
                onClick={() => void prepare("cancelWithdrawal")}
              >
                Cancel withdrawal
              </button>
              <button
                className="button"
                type="button"
                disabled={busy || !unlocked}
                onClick={() => void prepare("withdraw")}
              >
                Review withdrawal
              </button>
            </div>
          )}
          <p className="small-note">
            New deposits are disabled. Existing deposits retain the contract’s
            seven-day withdrawal cooldown.
          </p>
        </>
      )}
      {prepared && (
        <div className="tx-preview">
          <h3>Review withdrawal action</h3>
          <dl className="evidence-list">
            <dt>Action</dt>
            <dd>{prepared.action}</dd>
            <dt>Contract</dt>
            <dd>{prepared.to}</dd>
            <dt>Gas estimate</dt>
            <dd>{prepared.gas}</dd>
            <dt>Expires</dt>
            <dd>{prepared.expiresAt}</dd>
          </dl>
          <p>
            No deposit or token approval is requested. Your wallet asks for
            confirmation.
          </p>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            Confirm in wallet
          </button>
          <button
            className="button secondary-button"
            type="button"
            disabled={busy}
            onClick={() => setPrepared(null)}
          >
            Cancel review
          </button>
        </div>
      )}
      {hash && (
        <a
          className="text-link"
          href={`https://testnet.monadexplorer.com/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View transaction ↗
        </a>
      )}
    </div>
  );
}
