"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";

type Review = {
  mode: "live" | "demo";
  execution: string;
  wallet: string;
  market: string;
  marketId: number;
  exchange: string;
  collateral: string;
  side: "long" | "short";
  size: string;
  sizeUnits: string;
  leverage: number;
  maxLeverage: number;
  slippageBps: number;
  orderType: string;
  sourcePostId: string;
  expiresAt: string;
  observedAt: string;
};
type Result = {
  status: "demo" | "submitted" | "rejected";
  mode: "live" | "demo";
  requestId: number;
  market: string;
  message: string;
};

export default function ConfiguredPerpTrade() {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const [marketId, setMarketId] = useState("");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState("");
  const [leverage, setLeverage] = useState("2");
  const [slippage, setSlippage] = useState("100");
  const [postId, setPostId] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());
  const owner = useRef(user?.id);
  owner.current = user?.id;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const market = params.get("marketId"),
      requested = params.get("side"),
      source = params.get("postId"),
      lev = params.get("leverage");
    if (market && /^[0-9]{1,6}$/.test(market)) setMarketId(market);
    if (requested === "long" || requested === "short") setSide(requested);
    if (source && /^[0-9]{1,30}$/.test(source)) setPostId(source);
    if (lev && /^[0-9]{1,2}$/.test(lev)) setLeverage(lev);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear private state on account change.
  useEffect(() => {
    setReview(null);
    setResult(null);
    setNotice("");
  }, [user?.id, authenticated]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const expired = review ? Date.parse(review.expiresAt) <= now : false;
  function body(confirm: boolean) {
    if (!/^[0-9]{1,6}$/.test(marketId))
      throw new Error("Choose a Perpl market ID.");
    if (!/^[0-9]{1,30}$/.test(postId))
      throw new Error("Enter the source X post ID.");
    return {
      marketId: Number(marketId),
      side,
      size: size.trim(),
      leverage: Number(leverage),
      slippageBps: Number(slippage),
      sourcePostId: postId,
      ...(confirm ? { confirm: true } : {}),
    };
  }
  async function call(path: string, payload: unknown) {
    const token = await getAccessToken();
    if (!token) throw new Error("Session expired. Sign in again.");
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        typeof value.error === "string"
          ? value.error.replaceAll("_", " ")
          : "Perp service unavailable.",
      );
    return value;
  }
  async function prepare() {
    const account = owner.current;
    setBusy(true);
    setReview(null);
    setResult(null);
    setNotice("");
    try {
      const value = (await call(
        "/api/trades/perp/prepare",
        body(false),
      )) as Review;
      if (account === owner.current) setReview(value);
    } catch (error) {
      if (account === owner.current)
        setNotice(
          error instanceof Error ? error.message : "Review unavailable.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!review || expired) {
      setReview(null);
      setNotice("Review expired. Prepare again.");
      return;
    }
    const account = owner.current;
    setBusy(true);
    try {
      const value = (await call(
        "/api/trades/perp/submit",
        body(true),
      )) as Result;
      if (account !== owner.current) return;
      setResult(value);
      setReview(null);
    } catch (error) {
      if (account === owner.current)
        setNotice(
          error instanceof Error ? error.message : "Submission failed.",
        );
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p>Loading wallet session…</p>;
  if (!authenticated)
    return (
      <button className="button" type="button" onClick={() => login()}>
        Sign in to review a perp order
      </button>
    );
  return (
    <div className="stake-form">
      <fieldset className="side-toggle">
        <legend>Position</legend>
        {(["long", "short"] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            aria-pressed={side === choice}
            onClick={() => {
              setSide(choice);
              setReview(null);
            }}
          >
            {choice === "long" ? "Long" : "Short"}
          </button>
        ))}
      </fieldset>
      <label htmlFor="perp-market">Perpl market ID</label>
      <input
        id="perp-market"
        inputMode="numeric"
        value={marketId}
        disabled={busy}
        onChange={(e) => {
          setMarketId(e.target.value);
          setReview(null);
        }}
      />
      <label htmlFor="perp-size">Position size (base asset units)</label>
      <input
        id="perp-size"
        inputMode="decimal"
        maxLength={40}
        placeholder="0.001"
        value={size}
        disabled={busy}
        onChange={(e) => {
          setSize(e.target.value);
          setReview(null);
        }}
      />
      <label htmlFor="perp-leverage">
        Leverage (whole x; capped on the server)
      </label>
      <input
        id="perp-leverage"
        inputMode="numeric"
        value={leverage}
        disabled={busy}
        onChange={(e) => {
          setLeverage(e.target.value);
          setReview(null);
        }}
      />
      <label htmlFor="perp-slippage">
        Max slippage (basis points; 100 = 1%)
      </label>
      <input
        id="perp-slippage"
        inputMode="numeric"
        value={slippage}
        disabled={busy}
        onChange={(e) => {
          setSlippage(e.target.value);
          setReview(null);
        }}
      />
      <label htmlFor="perp-source">Source X post ID</label>
      <input
        id="perp-source"
        inputMode="numeric"
        maxLength={30}
        value={postId}
        disabled={busy}
        onChange={(e) => {
          setPostId(e.target.value);
          setReview(null);
        }}
      />
      <button
        className="button"
        type="button"
        disabled={busy}
        onClick={() => void prepare()}
      >
        Review perp order
      </button>
      {(notice || busy) && (
        <p role="status" className="stake-notice">
          {notice}
          {busy ? " Working…" : ""}
        </p>
      )}
      {review && (
        <section aria-label="Perp order review">
          <h3>
            Review {review.side} {review.market}
          </h3>
          <p className="stake-notice">{review.execution}</p>
          <dl className="quote-review">
            <div>
              <dt>Market</dt>
              <dd>
                {review.market} (#{review.marketId}) · {review.collateral}{" "}
                collateral
              </dd>
            </div>
            <div>
              <dt>Side</dt>
              <dd>{review.side === "long" ? "Open long" : "Open short"}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>
                {review.size} ({review.sizeUnits} market units)
              </dd>
            </div>
            <div>
              <dt>Leverage</dt>
              <dd>
                {review.leverage}x (server cap {review.maxLeverage}x)
              </dd>
            </div>
            <div>
              <dt>Order</dt>
              <dd>
                {review.orderType}; max slippage {review.slippageBps} bps
              </dd>
            </div>
            <div>
              <dt>Exchange</dt>
              <dd>{review.exchange} · Monad testnet</dd>
            </div>
            <div>
              <dt>Bound wallet</dt>
              <dd>{review.wallet}</dd>
            </div>
            <div>
              <dt>Source post</dt>
              <dd>{review.sourcePostId} · unverified</dd>
            </div>
            <div>
              <dt>Review expires</dt>
              <dd>{expired ? "Expired" : review.expiresAt}</dd>
            </div>
          </dl>
          <p className="small-note">
            Leverage can liquidate your collateral. Perpl forwards API orders
            for accounts that enabled order forwarding; submitted is not filled.
          </p>
          <button
            className="button"
            type="button"
            disabled={busy || expired}
            onClick={() => void submit()}
          >
            Confirm and submit order
          </button>
          <button
            className="button secondary-button"
            type="button"
            disabled={busy}
            onClick={() => setReview(null)}
          >
            Discard review
          </button>
        </section>
      )}
      {result && (
        <section aria-label="Perp order result">
          <h3>
            {result.status === "submitted"
              ? "Order submitted"
              : result.status === "rejected"
                ? "Order rejected"
                : "Demo order validated"}
          </h3>
          <p>{result.message}</p>
          <p className="small-note">
            Request {result.requestId} · {result.market}
          </p>
          {result.mode === "live" && (
            <a
              className="text-link"
              href="https://testnet.perpl.xyz"
              target="_blank"
              rel="noreferrer"
            >
              Check positions on Perpl ↗
            </a>
          )}
        </section>
      )}
    </div>
  );
}
