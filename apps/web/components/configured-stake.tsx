"use client";
import { preparedStakeSchema, stakeStateSchema } from "@call-my-bluff/domain";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { monadTestnet } from "viem/chains";

type State = ReturnType<typeof stakeStateSchema.parse>;
type Prepared = ReturnType<typeof preparedStakeSchema.parse>;
export default function ConfiguredStake() {
  const { ready, authenticated, getAccessToken, user, login, logout } =
    usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [state, setState] = useState<State | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [amount, setAmount] = useState("500");
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
          ...(action === "deposit" ? { amount } : {}),
        }),
      );
      if (activeUser.current === owner) {
        setPrepared(value);
        setState(value.state);
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
        "Submitted. Waiting for an onchain receipt; this is not a confirmed stake.",
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
        transaction.action === "deployMockUSDC"
          ? `Mock USDC deployed at ${receipt.contractAddress}, block ${receipt.blockNumber}. 10,000 mUSDC minted to the bound wallet. Verify this receipt, configure mock-token mode and deploy a new matching stake contract before deposits.`
          : transaction.action === "deploy"
            ? `Deployment confirmed at ${receipt.contractAddress}. Configure this address and deployment block ${receipt.blockNumber} on the server and indexer before deposits.`
            : `${transaction.action} confirmed in block ${receipt.blockNumber}. Latest state is unfinalized; indexing is pending. Prepare the next action separately.`,
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
        Sign in to inspect your stake
      </button>
    );
  return (
    <div className="stake-form">
      <p>
        Monad testnet · Test USDC has no monetary value. Identity, active stake
        and performance are separate signals.
      </p>
      <button
        className="button secondary-button"
        type="button"
        disabled={busy}
        onClick={() => void refresh()}
      >
        Refresh contract state
      </button>
      {sessionExpired && (
        <button
          className="button secondary-button"
          type="button"
          disabled={busy}
          onClick={async () => {
            setState(null);
            setPrepared(null);
            setHash(null);
            setNotice("");
            await logout();
            login();
          }}
        >
          Sign in again
        </button>
      )}
      {state && (
        <>
          <dl>
            <dt>Bound wallet</dt>
            <dd>{state.wallet}</dd>
            <dt>Stake contract</dt>
            <dd>{state.contract ?? "Not deployed/configured"}</dd>
            <dt>Token balance ({state.symbol})</dt>
            <dd>{formatUnits(BigInt(state.tokenBalance), 6)}</dd>
            <dt>Test MON for gas</dt>
            <dd>{formatUnits(BigInt(state.nativeBalance), 18)}</dd>
            <dt>Locked {state.symbol}</dt>
            <dd>
              {state.contract
                ? formatUnits(BigInt(state.balance), 6)
                : "Unavailable"}
            </dd>
            <dt>Active stake</dt>
            <dd>
              {state.contract
                ? BigInt(state.balance) >= BigInt(state.minimum) &&
                  state.withdrawableAt === "0"
                  ? "Active"
                  : "Inactive"
                : "Unavailable"}
            </dd>
            <dt>Withdrawal unlock (chain timestamp)</dt>
            <dd>
              {!state.contract
                ? "Unavailable"
                : state.withdrawableAt === "0"
                  ? "No pending withdrawal"
                  : state.withdrawableAt}
            </dd>
          </dl>
          <p>
            Minimum: 500 {state.symbol} · Cooldown: 7 days · Block{" "}
            {state.blockNumber} · Observed {state.observedAt} · Latest,
            unfinalized RPC snapshot; Envio indexing pending.
          </p>
          {state.symbol === "USDC" && (
            <>
              <p>
                For the hackathon demo, deploy our six-decimal mUSDC. It mints
                10,000 demo tokens to your bound wallet and has no monetary
                value or Circle affiliation. A new stake contract will be needed
                for this token.
              </p>
              <button
                className="button secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void prepare("deployMockUSDC")}
              >
                Prepare mock USDC deployment
              </button>
            </>
          )}
          {!state.contract ? (
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() => void prepare("deploy")}
            >
              Prepare testnet deployment
            </button>
          ) : (
            <>
              <label htmlFor="stake-amount">Deposit {state.symbol}</label>
              <input
                id="stake-amount"
                value={amount}
                inputMode="decimal"
                disabled={busy}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setPrepared(null);
                }}
              />
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => void prepare("deposit")}
              >
                Review next deposit step
              </button>
              <div className="button-row">
                {["requestWithdrawal", "cancelWithdrawal", "withdraw"].map(
                  (action) => (
                    <button
                      key={action}
                      className="button secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void prepare(action)}
                    >
                      Review {action}
                    </button>
                  ),
                )}
              </div>
            </>
          )}
        </>
      )}
      {prepared && (
        <section aria-label="Transaction review">
          <h3>Review {prepared.action}</h3>
          <p>
            Wallet: {prepared.wallet}
            <br />
            Chain: 10143
            <br />
            To:{" "}
            {prepared.to ??
              (prepared.action === "deployMockUSDC"
                ? "New MockUSDC demo token"
                : "New CreatorStake contract")}
            <br />
            Native value: 0<br />
            Estimated gas: {prepared.gas} (wallet gas limit includes a 20%
            buffer)
            <br />
            Expires: {prepared.expiresAt}
          </p>
          {prepared.action === "deployMockUSDC" ? (
            <p>
              Deploy Call My Bluff Mock USDC (mUSDC), six decimals. Mint 10,000
              mUSDC to {prepared.wallet}. Anyone else may claim 1,000 mUSDC once
              per address. Monad testnet only; no dollar backing or Circle
              affiliation.
            </p>
          ) : prepared.action === "deploy" ? (
            <p>
              Immutable token: {prepared.state.token}; minimum 500{" "}
              {prepared.state.symbol}; cooldown 604800 seconds. No administrator
              or slashing.
            </p>
          ) : (
            <p>
              {prepared.action === "approve"
                ? `Exact allowance: ${amount} ${prepared.state.symbol}.`
                : prepared.action === "resetAllowance"
                  ? "Reset the existing insufficient allowance to zero, then review another transaction."
                  : "Each action requires a separate wallet approval."}
            </p>
          )}
          <details>
            <summary>Unsigned transaction data</summary>
            <pre className="ownership-message">{prepared.data}</pre>
          </details>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void submit()}
          >
            Continue to wallet approval
          </button>
          <button
            className="button secondary-button"
            type="button"
            disabled={busy}
            onClick={() => setPrepared(null)}
          >
            Discard review
          </button>
        </section>
      )}
      <p role="status">
        {notice}
        {busy ? " Working…" : ""}
      </p>
      {hash && (
        <a
          className="text-link"
          href={`https://testnet.monadvision.com/tx/${hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View submitted transaction
        </a>
      )}
    </div>
  );
}
