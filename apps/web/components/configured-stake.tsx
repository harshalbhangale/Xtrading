"use client";
import { preparedStakeSchema, stakeStateSchema } from "@call-my-bluff/domain";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, http, parseUnits } from "viem";
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
        transaction.action === "faucet"
          ? `Faucet claim confirmed in block ${receipt.blockNumber}. 1,000 mUSDC minted to the bound wallet. Latest state is unfinalized; this is not an active stake.`
          : transaction.action === "deployMockUSDC"
            ? `Mock USDC deployed at ${receipt.contractAddress}, block ${receipt.blockNumber}. 10,000 mUSDC minted to the bound wallet. Verify this receipt, configure mock-token mode and deploy a new matching stake contract before deposits.`
            : transaction.action === "deploy"
              ? `Deployment confirmed at ${receipt.contractAddress}. Configure this address and deployment block ${receipt.blockNumber} on the server and indexer before deposits.`
              : `${transaction.action} confirmed in block ${receipt.blockNumber}. Latest state is unfinalized; check indexed evidence below. Prepare the next action separately.`,
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
  const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
  const locked = state?.contract ? BigInt(state.balance) : 0n;
  const minimum = state ? BigInt(state.minimum) : 0n;
  const isActive =
    !!state?.contract && locked >= minimum && state.withdrawableAt === "0";
  const pending = !!state?.contract && state.withdrawableAt !== "0";
  const status = !state?.contract
    ? "Not configured"
    : pending
      ? "Withdrawal pending"
      : isActive
        ? "Active"
        : "Inactive";
  // Exact integer math only; an invalid amount simply disables the stepper.
  let units = 0n;
  try {
    units = parseUnits(amount.trim(), 6);
  } catch {
    units = 0n;
  }
  const allowance = state ? BigInt(state.allowance) : 0n;
  const approved = units > 0n && allowance >= units;
  const needsReset = units > 0n && allowance > 0n && allowance < units;
  const stepLabel = approved
    ? "Deposit"
    : needsReset
      ? "Reset allowance"
      : "Approve";
  const progress =
    minimum > 0n ? Math.min(100, Number((locked * 100n) / minimum)) : 0;
  const indexer =
    state?.indexing?.status === "current"
      ? "Indexer live"
      : state?.indexing?.status === "lagging"
        ? "Indexer catching up"
        : "Indexer unavailable";
  return (
    <div className="sk">
      <div className="sk-head">
        <span
          className={`sk-status ${isActive ? "on" : pending ? "wait" : "off"}`}
        >
          <i /> {state ? status : "Checking…"}
        </span>
        <span className="sk-meta">Monad testnet · test tokens, no value</span>
        <button
          className="button secondary-button sk-refresh"
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
        >
          Refresh
        </button>
      </div>
      {(notice || busy) && (
        <p role="status" className="sk-notice">
          {notice}
          {busy ? " Working…" : ""}
        </p>
      )}
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
          <div className="sk-tiles">
            <div className="sk-tile">
              <span>Locked</span>
              <strong>
                {state.contract ? formatUnits(locked, 6) : "—"}
                <small> {state.symbol}</small>
              </strong>
            </div>
            <div className="sk-tile">
              <span>Wallet balance</span>
              <strong>
                {formatUnits(BigInt(state.tokenBalance), 6)}
                <small> {state.symbol}</small>
              </strong>
            </div>
            <div className="sk-tile">
              <span>Gas</span>
              <strong>
                {Number(formatUnits(BigInt(state.nativeBalance), 18)).toFixed(
                  3,
                )}
                <small> MON</small>
              </strong>
            </div>
            <div className="sk-tile">
              <span>Withdrawal</span>
              <strong>
                {!state.contract
                  ? "—"
                  : state.withdrawableAt === "0"
                    ? "None"
                    : new Date(
                        Number(BigInt(state.withdrawableAt) * 1000n),
                      ).toLocaleDateString()}
              </strong>
            </div>
          </div>
          {state.contract && (
            <div
              className="sk-progress"
              role="img"
              aria-label={`Locked ${formatUnits(locked, 6)} of ${formatUnits(minimum, 6)} ${state.symbol} minimum`}
            >
              <div>
                <i style={{ width: `${progress}%` }} />
              </div>
              <span>
                {formatUnits(locked, 6)} / {formatUnits(minimum, 6)}{" "}
                {state.symbol} minimum · 7-day cooldown
              </span>
            </div>
          )}
          <p className="sk-addresses">
            <span title={state.wallet}>Wallet {short(state.wallet)}</span>
            {state.contract && (
              <span title={state.contract}>
                Contract {short(state.contract)}
              </span>
            )}
          </p>

          {state.faucetClaimed === false && (
            <div className="sk-banner">
              <span>Need test {state.symbol}? Claim 1,000 once.</span>
              <button
                className="button secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void prepare("faucet")}
              >
                Review faucet claim
              </button>
            </div>
          )}
          {state.symbol === "USDC" && (
            <div className="sk-banner">
              <span>
                Demo token needed: deploy mUSDC (10,000 minted to your wallet).
              </span>
              <button
                className="button secondary-button"
                type="button"
                disabled={busy}
                onClick={() => void prepare("deployMockUSDC")}
              >
                Prepare mUSDC deployment
              </button>
            </div>
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
            <div className="sk-actions">
              <div className="sk-deposit">
                <label htmlFor="stake-amount">Amount ({state.symbol})</label>
                <ol className="sk-steps" aria-label="Deposit steps">
                  <li className={approved ? "done" : "now"}>
                    <i>{approved ? "✓" : "1"}</i>
                    {needsReset ? "Reset old allowance" : "Approve"}
                  </li>
                  <li className={approved ? "now" : ""}>
                    <i>2</i>
                    Deposit
                  </li>
                </ol>
                <div>
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
                    disabled={busy || units === 0n}
                    onClick={() => void prepare("deposit")}
                  >
                    {stepLabel}
                    {units > 0n && !needsReset ? ` ${amount.trim()}` : ""}
                  </button>
                </div>
                <p className="sk-meta">
                  {approved
                    ? `Approved ${formatUnits(allowance, 6)} ${state.symbol}. Deposit is the last step.`
                    : "Two wallet approvals: an exact-amount allowance, then the deposit."}
                </p>
              </div>
              <div className="sk-withdraw">
                {[
                  ["requestWithdrawal", "Request withdrawal"],
                  ["cancelWithdrawal", "Cancel withdrawal"],
                  ["withdraw", "Withdraw"],
                ].map(([action, label]) => (
                  <button
                    key={action}
                    className="button secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void prepare(action as string)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <details className="sk-evidence">
            <summary>
              Evidence <span>{indexer}</span>
            </summary>
            <p className="sk-meta">
              RPC block {state.blockNumber} · {state.observedAt} · latest,
              unfinalized
              {state.indexing?.progressBlock &&
                ` · Envio block ${state.indexing.progressBlock}`}
            </p>
            {state.indexing?.events.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Locked ({state.symbol})</th>
                    <th>Unlock</th>
                    <th>Chain time</th>
                    <th>Block</th>
                  </tr>
                </thead>
                <tbody>
                  {state.indexing.events.map((event) => (
                    <tr key={event.id}>
                      <td>{formatUnits(BigInt(event.balance), 6)}</td>
                      <td>
                        {event.withdrawableAt === "0"
                          ? "None"
                          : new Date(
                              Number(BigInt(event.withdrawableAt) * 1000n),
                            ).toLocaleString()}
                      </td>
                      <td>
                        {new Date(
                          Number(BigInt(event.timestamp) * 1000n),
                        ).toLocaleString()}
                      </td>
                      <td>
                        <a
                          href={`https://testnet.monadvision.com/block/${event.blockNumber}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {event.blockNumber}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="sk-meta">
                {state.indexing?.status === "current"
                  ? "No stake events indexed for this wallet."
                  : "History unavailable until the indexer catches up."}
              </p>
            )}
          </details>
        </>
      )}
      {prepared && (
        <section className="sk-review" aria-label="Transaction review">
          <h3>Review {prepared.action}</h3>
          <dl>
            <dt>Wallet</dt>
            <dd>{prepared.wallet}</dd>
            <dt>Chain</dt>
            <dd>10143</dd>
            <dt>To</dt>
            <dd>
              {prepared.to ??
                (prepared.action === "deployMockUSDC"
                  ? "New MockUSDC demo token"
                  : "New CreatorStake contract")}
            </dd>
            <dt>Value</dt>
            <dd>0</dd>
            <dt>Gas</dt>
            <dd>{prepared.gas} (limit includes a 20% buffer)</dd>
            <dt>Expires</dt>
            <dd>{prepared.expiresAt}</dd>
          </dl>
          {prepared.action === "faucet" ? (
            <p>
              Mint 1,000 demo mUSDC to {prepared.wallet}. One claim per address,
              Monad testnet only. These tokens have no monetary value and no
              Circle affiliation.
            </p>
          ) : prepared.action === "deployMockUSDC" ? (
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
          <div className="sk-review-actions">
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
              Discard
            </button>
          </div>
        </section>
      )}
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
