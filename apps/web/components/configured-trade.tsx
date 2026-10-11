"use client";
import { kuruTestnet } from "@call-my-bluff/integrations/kuru";
import { spotReviewSchema } from "@call-my-bluff/integrations/market-schemas";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { createPublicClient, formatUnits, http } from "viem";
import { monadTestnet } from "viem/chains";

type Review = ReturnType<typeof spotReviewSchema.parse>;
export default function ConfiguredTrade() {
  const { ready, authenticated, user, login, logout, getAccessToken } =
    usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [postId, setPostId] = useState("");
  const [slippage, setSlippage] = useState("100");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [expiredSession, setExpiredSession] = useState(false);
  const [now, setNow] = useState(Date.now());
  const owner = useRef(user?.id);
  owner.current = user?.id;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("instrument") !== "spot" ||
      params.get("chainId") !== "10143"
    )
      return;
    const requestedSide = params.get("side"),
      source = params.get("postId");
    if (requestedSide === "buy" || requestedSide === "sell")
      setSide(requestedSide);
    if (source && /^[0-9]{1,30}$/.test(source)) setPostId(source);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear private state on account change.
  useEffect(() => {
    setReview(null);
    setHash(null);
    setNotice("");
  }, [user?.id, authenticated]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const inputSymbol = side === "buy" ? "Kuru test USDC" : "test MON";
  const outputSymbol = side === "buy" ? "MON" : "Kuru test USDC";
  const expired = review ? Date.parse(review.expiresAt) <= now : false;
  function intent() {
    if (!/^[0-9]{1,30}$/.test(postId))
      throw new Error("Enter the source X post ID.");
    if (!/^[0-9]{1,3}$/.test(slippage))
      throw new Error("Slippage must be 1–500 basis points.");
    return {
      instrument: "spot",
      chainId: 10143,
      side,
      amount: stakeUnits(amount, side === "buy" ? 6 : 18).toString(),
      slippageBps: Number(slippage),
      sourcePostId: postId,
    };
  }
  async function freshReview() {
    const token = await getAccessToken();
    if (!token) {
      setExpiredSession(true);
      throw new Error("Session expired. Sign in again.");
    }
    const response = await fetch("/api/trades/prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(intent()),
    });
    const value = await response.json();
    if (response.status === 401) {
      setExpiredSession(true);
      throw new Error("Session expired. Sign in again.");
    }
    if (!response.ok)
      throw new Error(
        typeof value.error === "string"
          ? value.error.replaceAll("_", " ")
          : "Trade service unavailable.",
      );
    setExpiredSession(false);
    const result = spotReviewSchema.parse(value);
    const target =
      result.action === "order" ? kuruTestnet.market : kuruTestnet.quote;
    if (result.to.toLowerCase() !== target.toLowerCase())
      throw new Error("Unexpected transaction target.");
    return result;
  }
  async function prepare() {
    const account = owner.current;
    setBusy(true);
    setReview(null);
    setNotice("");
    setHash(null);
    try {
      const result = await freshReview();
      if (account === owner.current) setReview(result);
    } catch (error) {
      if (account === owner.current)
        setNotice(
          error instanceof Error ? error.message : "Quote unavailable.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!review || Date.parse(review.expiresAt) <= Date.now()) {
      setReview(null);
      setNotice("Quote expired. Prepare again.");
      return;
    }
    const account = owner.current;
    const previous = review;
    setBusy(true);
    setHash(null);
    try {
      const current = await freshReview();
      if (owner.current !== account) return;
      if (current.wallet.toLowerCase() !== previous.wallet.toLowerCase())
        throw new Error("Wallet changed. Prepare again.");
      if (
        current.action !== previous.action ||
        current.to !== previous.to ||
        current.data !== previous.data ||
        current.value !== previous.value
      ) {
        setReview(current);
        setNotice(
          "Quote or approval step changed. Review the updated values before continuing.",
        );
        return;
      }
      const wallet = wallets.find(
        (item) => item.address.toLowerCase() === current.wallet.toLowerCase(),
      );
      if (!wallet) throw new Error("Bound wallet is not connected.");
      await wallet.switchChain(10143);
      if (
        owner.current !== account ||
        Date.parse(current.expiresAt) <= Date.now()
      )
        throw new Error("Account changed or quote expired. Prepare again.");
      setReview(null);
      const sent = await sendTransaction(
        {
          chainId: 10143,
          to: current.to,
          data: current.data as `0x${string}`,
          value: BigInt(current.value),
          gasLimit: (BigInt(current.gas) * 120n) / 100n,
        },
        { address: current.wallet, uiOptions: { showWalletUIs: true } },
      );
      if (owner.current !== account) return;
      setHash(sent.hash);
      setNotice("Submitted. Waiting for a receipt; no fill is claimed yet.");
      const receipt = await createPublicClient({
        chain: monadTestnet,
        transport: http(),
      }).waitForTransactionReceipt({
        hash: sent.hash,
        confirmations: 2,
        timeout: 120000,
      });
      if (owner.current !== account) return;
      if (receipt.status !== "success")
        throw new Error(
          "Transaction reverted. No successful trade is claimed.",
        );
      setNotice(
        current.action === "order"
          ? `Order transaction confirmed in block ${receipt.blockNumber}. Fill indexing and dashboard reconciliation remain pending.`
          : `${current.action} confirmed. Request a fresh quote and review the next step separately.`,
      );
    } catch (error) {
      if (owner.current === account) {
        setReview(null);
        const message =
          error instanceof Error ? error.message : "Wallet request failed.";
        if (
          /invalid.?auth.?token|token.?expired|expired.?token/i.test(message)
        ) {
          setExpiredSession(true);
          setNotice(
            "Wallet session expired. Sign in again. No transaction is retried automatically.",
          );
        } else setNotice(message);
      }
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p>Loading wallet session…</p>;
  if (!authenticated)
    return (
      <button type="button" className="button" onClick={() => login()}>
        Sign in to review a spot trade
      </button>
    );
  return (
    <div className="stake-form">
      <p>
        Kuru · MON / USDC · Monad testnet 10143. Test tokens have no monetary
        value.
      </p>
      <p>
        Kuru USDC: <code>{kuruTestnet.quote}</code>. Staking USDC and mUSDC
        cannot be used in this market.
      </p>
      <fieldset
        className="preview-selector"
        aria-label="Trade side"
        disabled={busy}
      >
        {(["buy", "sell"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={side === choice}
            onClick={() => {
              setSide(choice);
              setReview(null);
            }}
          >
            {choice === "buy" ? "Buy MON" : "Sell MON"}
          </button>
        ))}
      </fieldset>
      <label htmlFor="trade-amount">Amount to spend ({inputSymbol})</label>
      <input
        id="trade-amount"
        inputMode="decimal"
        maxLength={80}
        disabled={busy}
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value);
          setReview(null);
          setNotice("");
        }}
        placeholder="0.00"
      />
      <label htmlFor="trade-slippage">
        Slippage limit (basis points; 100 = 1%)
      </label>
      <input
        id="trade-slippage"
        inputMode="numeric"
        disabled={busy}
        value={slippage}
        onChange={(event) => {
          setSlippage(event.target.value);
          setReview(null);
          setNotice("");
        }}
      />
      <label htmlFor="trade-source">Source X post ID</label>
      <input
        id="trade-source"
        inputMode="numeric"
        maxLength={30}
        disabled={busy}
        value={postId}
        onChange={(event) => {
          setPostId(event.target.value);
          setReview(null);
          setNotice("");
        }}
      />
      <p className="small-note">
        Source attribution is user-supplied and unverified. Perp calls open the
        Perpl review instead.
      </p>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() => void prepare()}
      >
        Get quote / review next step
      </button>
      {expiredSession && (
        <button
          type="button"
          className="button secondary-button"
          disabled={busy}
          onClick={async () => {
            setReview(null);
            await logout();
            login();
          }}
        >
          Sign in again
        </button>
      )}
      {review && (
        <section aria-label="Spot transaction review">
          <h3>
            {review.action === "order"
              ? "Review spot order"
              : review.action === "approve"
                ? "Review exact token approval"
                : "Review allowance reset"}
          </h3>
          <dl className="quote-review">
            <div>
              <dt>Wallet</dt>
              <dd>{review.wallet}</dd>
            </div>
            <div>
              <dt>Input</dt>
              <dd>
                {formatUnits(BigInt(review.amount), side === "buy" ? 6 : 18)}{" "}
                {inputSymbol}
              </dd>
            </div>
            <div>
              <dt>Expected output</dt>
              <dd>
                {review.expectedOutput
                  ? `${formatUnits(BigInt(review.expectedOutput), side === "buy" ? 18 : 6)} ${outputSymbol}`
                  : "Unavailable until approval is confirmed"}
              </dd>
            </div>
            <div>
              <dt>Minimum received</dt>
              <dd>
                {review.minimumOutput
                  ? `${formatUnits(BigInt(review.minimumOutput), side === "buy" ? 18 : 6)} ${outputSymbol}`
                  : "Order not prepared"}
              </dd>
            </div>
            <div>
              <dt>Trading fee</dt>
              <dd>
                {review.action === "order"
                  ? review.tradingFee
                  : "No trade in this step"}
              </dd>
            </div>
            <div>
              <dt>Estimated network fee (20% gas buffer)</dt>
              <dd>
                {formatUnits(
                  ((BigInt(review.gas) * 120n) / 100n) *
                    BigInt(review.gasPrice),
                  18,
                )}{" "}
                MON; wallet shows final fee
              </dd>
            </div>
            <div>
              <dt>Source post</dt>
              <dd>{review.sourcePostId} · unverified</dd>
            </div>
            <div>
              <dt>Review expires</dt>
              <dd>{expired ? "Expired" : review.expiresAt}</dd>
            </div>
            <div>
              <dt>Token approval limit</dt>
              <dd>
                {review.action === "approve"
                  ? `${formatUnits(BigInt(review.amount), 6)} Kuru USDC`
                  : review.action === "resetAllowance"
                    ? "Zero"
                    : "No new approval"}
              </dd>
            </div>
          </dl>
          <p>
            Block {review.blockNumber} · Observed {review.observedAt} ·
            Unfinalized.{" "}
            {review.action === "order"
              ? "Simulated fill-or-kill output is an estimate; the contract enforces the minimum."
              : "An approval does not place an order or establish a quote."}{" "}
            The app refreshes before wallet review; this market has no onchain
            deadline.
          </p>
          <details>
            <summary>Unsigned transaction</summary>
            <p>To: {review.to}</p>
            <pre className="ownership-message">{review.data}</pre>
          </details>
          <button
            type="button"
            className="button"
            disabled={busy || expired}
            onClick={() => void submit()}
          >
            Continue to wallet approval
          </button>
          <button
            type="button"
            className="button secondary-button"
            disabled={busy}
            onClick={() => setReview(null)}
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
