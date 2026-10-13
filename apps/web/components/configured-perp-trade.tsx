"use client";
import {
  changeBps,
  formatUsd,
  fromUnits,
  liquidationPrice,
  sizeFromUsd,
  ticketQuote,
  toUnits,
} from "@call-my-bluff/domain";
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
type Status = {
  requestId: number;
  order: {
    status: string;
    originalSize: string;
    filledSize: string;
    fillPrice: string;
    fee: string;
    block: number | null;
    transactionHash: string | null;
  } | null;
  position: {
    side: string;
    size: string;
    entryPrice: string;
    collateral: string;
    leverage: number;
  } | null;
};
type Market = {
  marketId: number;
  symbol: string;
  name?: string;
  sizeUnits?: string;
  sizeDecimals: number;
  priceDecimals: number;
  open: boolean;
  quote?: {
    mark: string | null;
    mid: string | null;
    bid: string | null;
    ask: string | null;
    previous: string | null;
  };
  takerFeePpm?: number | null;
  maxSlippageBps?: number | null;
  marketMaxLeverage?: number | null;
  maintenanceMarginHundredths?: number | null;
};
type Limits = { maxLeverage: number; maxSize: string };
type Result = {
  status: "demo" | "submitted" | "rejected";
  mode: "live" | "demo";
  requestId: number;
  market: string;
  message: string;
};

export default function ConfiguredPerpTrade({
  initialParams,
}: {
  initialParams?: string;
} = {}) {
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
  const [markets, setMarkets] = useState<Market[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [unit, setUnit] = useState<"base" | "usd">("base");
  const [showLeverage, setShowLeverage] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  useEffect(() => {
    const params = new URLSearchParams(initialParams ?? window.location.search);
    const market = params.get("marketId"),
      requested = params.get("side"),
      source = params.get("postId"),
      lev = params.get("leverage"),
      amount = params.get("size"),
      bps = params.get("slippage");
    if (market && /^[0-9]{1,6}$/.test(market)) setMarketId(market);
    if (requested === "long" || requested === "short") setSide(requested);
    if (source && /^[0-9]{1,30}$/.test(source)) setPostId(source);
    if (lev && /^[0-9]{1,2}$/.test(lev)) setLeverage(lev);
    if (amount && /^[0-9]{1,12}(\.[0-9]{1,18})?$/.test(amount)) setSize(amount);
    if (bps && /^[0-9]{1,3}$/.test(bps)) setSlippage(bps);
  }, [initialParams]);
  useEffect(() => {
    fetch("/api/markets", { cache: "no-store" })
      .then((r) => r.json())
      .then((value: { perpl?: { markets?: Market[]; limits?: Limits } }) => {
        const open = (value.perpl?.markets ?? []).filter((m) => m.open);
        setMarkets(open);
        setLimits(value.perpl?.limits ?? null);
        setMarketId(
          (current) =>
            current ||
            String(
              open.find((m) => m.symbol === "MON")?.marketId ??
                open[0]?.marketId ??
                "",
            ),
        );
      })
      .catch(() => setMarkets([]));
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
  const selected = markets.find((m) => String(m.marketId) === marketId);
  const mark = selected?.quote?.mark ? BigInt(selected.quote.mark) : null;
  const sizeUnits = (() => {
    if (!selected) return null;
    if (unit === "base") return toUnits(size, selected.sizeDecimals);
    const usd = toUnits(size, selected.priceDecimals);
    return usd !== null && mark
      ? sizeFromUsd(usd, mark, selected.sizeDecimals)
      : null;
  })();
  const orderSize =
    selected && sizeUnits !== null
      ? fromUnits(sizeUnits, selected.sizeDecimals)
      : size.trim();
  const maxUnits =
    selected && limits ? toUnits(limits.maxSize, selected.sizeDecimals) : null;
  const quote =
    selected && mark && sizeUnits
      ? ticketQuote({
          sizeUnits,
          sizeDecimals: selected.sizeDecimals,
          price: mark,
          priceDecimals: selected.priceDecimals,
          leverage: Number(leverage) || 1,
          takerFeePpm: selected.takerFeePpm ?? 0,
        })
      : null;
  const change =
    mark && selected?.quote?.previous
      ? changeBps(mark, BigInt(selected.quote.previous))
      : null;
  const percent =
    sizeUnits && maxUnits && maxUnits > 0n
      ? Math.min(100, Number((sizeUnits * 100n) / maxUnits))
      : 0;
  const usd = (value: bigint | null) =>
    value === null || !selected
      ? "—"
      : formatUsd(value, selected.priceDecimals);
  const maxLev = Math.min(
    limits?.maxLeverage ?? 5,
    selected?.marketMaxLeverage ?? 50,
  );
  const liquidation =
    mark && selected?.maintenanceMarginHundredths
      ? liquidationPrice({
          entry: mark,
          side,
          leverageHundredths: (Number(leverage) || 1) * 100,
          maintenanceHundredths: selected.maintenanceMarginHundredths,
        })
      : null;
  const sizeError =
    size.trim() === ""
      ? null
      : sizeUnits === null
        ? `Use at most ${selected?.sizeDecimals ?? 0} decimals`
        : sizeUnits === 0n
          ? "Size rounds to zero"
          : maxUnits !== null && sizeUnits > maxUnits
            ? `Above the ${limits?.maxSize} ${selected?.symbol} cap`
            : null;
  const canReview =
    !busy && !!selected && !!sizeUnits && sizeUnits > 0n && !sizeError;
  const expired = review ? Date.parse(review.expiresAt) <= now : false;
  function body(confirm: boolean) {
    if (!/^[0-9]{1,6}$/.test(marketId))
      throw new Error("Choose a Perpl market ID.");
    if (postId && !/^[0-9]{1,30}$/.test(postId))
      throw new Error("Source post ID must be digits.");
    return {
      marketId: Number(marketId),
      side,
      size: orderSize,
      leverage: Number(leverage),
      slippageBps: Number(slippage),
      sourcePostId: postId || null,
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
      setStatus(null);
      if (value.status === "submitted") void track(value.requestId);
    } catch (error) {
      if (account === owner.current)
        setNotice(
          error instanceof Error ? error.message : "Submission failed.",
        );
    } finally {
      setBusy(false);
    }
  }
  // Forwarding is not execution: read the order, fill and position back.
  async function track(requestId: number) {
    const account = owner.current;
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (account !== owner.current) return;
      try {
        const token = await getAccessToken();
        const response = await fetch(
          `/api/trades/perp/status?rq=${requestId}`,
          { cache: "no-store", headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) continue;
        const value = (await response.json()) as Status;
        setStatus(value);
        if (
          value.order &&
          !["pending", "open", "partially-filled"].includes(value.order.status)
        )
          return;
      } catch {
        // Retry on the next tick; the order outcome does not depend on polling.
      }
    }
  }
  if (!ready) return <p>Loading wallet session…</p>;
  if (!authenticated)
    return (
      <button className="button" type="button" onClick={() => login()}>
        Sign in to trade perps
      </button>
    );
  const setPercent = (value: number) => {
    if (!selected || !maxUnits) return;
    setUnit("base");
    setSize(
      fromUnits((maxUnits * BigInt(value)) / 100n, selected.sizeDecimals),
    );
    setReview(null);
  };
  const sideLabel =
    `${side === "long" ? "Long" : "Short"} ${selected?.symbol ?? ""}`.trim();
  return (
    <div className="pt">
      <section className="pt-market" aria-label="Market">
        <label htmlFor="perp-market" className="pt-label">
          Market
        </label>
        <select
          id="perp-market"
          className="pt-select"
          value={marketId}
          disabled={busy}
          onChange={(e) => {
            setMarketId(e.target.value);
            setSize("");
            setReview(null);
          }}
        >
          {!markets.length && <option value="">Loading Perpl markets…</option>}
          {markets.map((m) => (
            <option key={m.marketId} value={m.marketId}>
              {m.symbol}-PERP
            </option>
          ))}
        </select>
        <div className="pt-price">
          <strong>{mark ? usd(mark) : "—"}</strong>
          {change !== null && (
            <span className={change >= 0 ? "up" : "down"}>
              {change >= 0 ? "+" : ""}
              {(change / 100).toFixed(2)}%
            </span>
          )}
        </div>
        <dl className="pt-stats">
          <div>
            <dt>Bid</dt>
            <dd>
              {selected?.quote?.bid ? usd(BigInt(selected.quote.bid)) : "—"}
            </dd>
          </div>
          <div>
            <dt>Ask</dt>
            <dd>
              {selected?.quote?.ask ? usd(BigInt(selected.quote.ask)) : "—"}
            </dd>
          </div>
          <div>
            <dt>Taker fee</dt>
            <dd>
              {selected?.takerFeePpm != null
                ? `${(selected.takerFeePpm / 10_000).toFixed(4)}%`
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Max size</dt>
            <dd>
              {limits ? `${limits.maxSize} ${selected?.symbol ?? ""}` : "—"}
            </dd>
          </div>
        </dl>
        <p className="pt-foot">
          Perpl · Monad testnet · AUSD collateral · market (IOC) orders
        </p>
      </section>

      <section className="pt-ticket" aria-label="Order ticket">
        <div className="pt-tabs">
          <span className="active">Market</span>
          <button
            type="button"
            className="pt-lev"
            aria-expanded={showLeverage}
            onClick={() => setShowLeverage((open) => !open)}
          >
            {leverage || 1}x
          </button>
        </div>
        {showLeverage && (
          <div className="pt-lev-panel">
            <input
              type="range"
              min={1}
              max={maxLev}
              step={1}
              value={Math.min(Number(leverage) || 1, maxLev)}
              aria-label="Leverage"
              onChange={(e) => {
                setLeverage(e.target.value);
                setReview(null);
              }}
            />
            <div className="pt-chips">
              {[1, 2, 3, 5, 10, 20]
                .filter((x) => x <= maxLev)
                .map((x) => (
                  <button
                    key={x}
                    type="button"
                    aria-pressed={Number(leverage) === x}
                    onClick={() => {
                      setLeverage(String(x));
                      setReview(null);
                    }}
                  >
                    {x}x
                  </button>
                ))}
            </div>
            <small>
              Max {maxLev}x (market {selected?.marketMaxLeverage ?? "—"}x, app
              cap {limits?.maxLeverage ?? "—"}x)
            </small>
          </div>
        )}
        <div className="pt-side">
          {(["long", "short"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={side === choice}
              className={choice}
              onClick={() => {
                setSide(choice);
                setReview(null);
              }}
            >
              {choice === "long" ? "Long" : "Short"}
            </button>
          ))}
        </div>

        <div className={`pt-field${sizeError ? " invalid" : ""}`}>
          <label htmlFor="perp-size">Size</label>
          <input
            id="perp-size"
            inputMode="decimal"
            maxLength={40}
            placeholder={
              selected
                ? unit === "usd"
                  ? "0.00"
                  : fromUnits(0n, selected.sizeDecimals)
                : "0"
            }
            value={size}
            disabled={busy}
            onChange={(e) => {
              setSize(e.target.value);
              setReview(null);
            }}
          />
          <button
            type="button"
            className="pt-unit"
            title="Switch between asset and USD"
            onClick={() => {
              setUnit((u) => (u === "base" ? "usd" : "base"));
              setSize("");
            }}
          >
            {unit === "usd" ? "USD" : (selected?.symbol ?? "—")} ⇄
          </button>
        </div>
        {sizeError && <p className="pt-error">{sizeError}</p>}
        {unit === "usd" && sizeUnits !== null && selected && (
          <p className="pt-hint">
            ≈ {fromUnits(sizeUnits, selected.sizeDecimals)} {selected.symbol}
          </p>
        )}
        <div className="pt-percent">
          <input
            type="range"
            min={0}
            max={100}
            step={25}
            value={percent}
            aria-label="Percent of maximum size"
            disabled={!maxUnits}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
          <span>{percent}%</span>
        </div>

        <div className="pt-slippage">
          <span>Max slippage</span>
          {[10, 50, 100]
            .filter((bps) => bps <= (selected?.maxSlippageBps ?? 500))
            .map((bps) => (
              <button
                key={bps}
                type="button"
                aria-pressed={Number(slippage) === bps}
                onClick={() => {
                  setSlippage(String(bps));
                  setReview(null);
                }}
              >
                {bps / 100}%
              </button>
            ))}
        </div>
        {postId && (
          <p className="pt-post">
            From X post …{postId.slice(-6)}{" "}
            <button type="button" onClick={() => setPostId("")}>
              Remove
            </button>
          </p>
        )}

        {!review ? (
          <button
            className={`pt-submit ${side}`}
            type="button"
            disabled={!canReview}
            onClick={() => void prepare()}
          >
            {busy ? "Checking…" : `Review ${sideLabel}`}
          </button>
        ) : (
          <section className="pt-review" aria-label="Perp order review">
            <p className="pt-review-title">
              {review.side === "long" ? "Long" : "Short"} {review.size}{" "}
              {review.market} · {review.leverage}x
            </p>
            <p className="pt-mode">
              {review.mode === "live" ? "Live" : "Demo"} · {review.execution}
            </p>
            <div className="pt-review-actions">
              <button
                className={`pt-submit ${review.side}`}
                type="button"
                disabled={busy || expired}
                onClick={() => void submit()}
              >
                {expired
                  ? "Review expired"
                  : `Confirm ${review.side === "long" ? "Long" : "Short"}`}
              </button>
              <button
                className="pt-back"
                type="button"
                disabled={busy}
                onClick={() => setReview(null)}
              >
                Back
              </button>
            </div>
          </section>
        )}
        {notice && (
          <p role="status" className="pt-error">
            {notice}
          </p>
        )}

        <dl className="pt-summary">
          <div>
            <dt>Order value</dt>
            <dd>{usd(quote?.notional ?? null)}</dd>
          </div>
          <div>
            <dt>Margin required</dt>
            <dd>{usd(quote?.margin ?? null)}</dd>
          </div>
          <div>
            <dt>Est. taker fee</dt>
            <dd>
              {quote && selected
                ? formatUsd(quote.feeFine, selected.priceDecimals + 4)
                : "—"}
            </dd>
          </div>
          <div>
            <dt>Est. liquidation</dt>
            <dd>{quote && liquidation ? usd(liquidation) : "—"}</dd>
          </div>
          <div>
            <dt>Max slippage</dt>
            <dd>{(Number(slippage) / 100).toFixed(2)}%</dd>
          </div>
        </dl>
        <p className="pt-foot">
          Estimates at mark price, before fees and funding. Leverage can
          liquidate collateral.
        </p>

        {result && (
          <section
            className={`pt-result ${result.status}`}
            aria-label="Perp order result"
          >
            <strong>
              {result.status === "submitted"
                ? "Order submitted"
                : result.status === "rejected"
                  ? "Order rejected"
                  : "Demo order validated"}
            </strong>
            <p>{result.message}</p>
            {result.status === "submitted" && (
              <dl className="pt-summary">
                <div>
                  <dt>Status</dt>
                  <dd>{status?.order?.status ?? "Waiting for Perpl…"}</dd>
                </div>
                {status?.order && selected && (
                  <>
                    <div>
                      <dt>Filled</dt>
                      <dd>
                        {fromUnits(
                          BigInt(status.order.filledSize),
                          selected.sizeDecimals,
                        )}{" "}
                        /{" "}
                        {fromUnits(
                          BigInt(status.order.originalSize),
                          selected.sizeDecimals,
                        )}{" "}
                        {selected.symbol}
                      </dd>
                    </div>
                    <div>
                      <dt>Avg fill price</dt>
                      <dd>
                        {status.order.fillPrice === "0"
                          ? "—"
                          : formatUsd(
                              BigInt(status.order.fillPrice),
                              selected.priceDecimals,
                            )}
                      </dd>
                    </div>
                  </>
                )}
                {status?.position && selected && (
                  <div>
                    <dt>Position</dt>
                    <dd>
                      {status.position.side}{" "}
                      {fromUnits(
                        BigInt(status.position.size),
                        selected.sizeDecimals,
                      )}{" "}
                      {selected.symbol} @{" "}
                      {formatUsd(
                        BigInt(status.position.entryPrice),
                        selected.priceDecimals,
                      )}{" "}
                      · {status.position.leverage / 100}x
                    </dd>
                  </div>
                )}
                {status?.order?.transactionHash && (
                  <div>
                    <dt>Onchain</dt>
                    <dd>
                      <a
                        className="text-link"
                        href={`https://testnet.monadvision.com/tx/${status.order.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Block {status.order.block} ↗
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
            {result.mode === "live" && (
              <a
                className="text-link"
                href="https://testnet.perpl.xyz"
                target="_blank"
                rel="noreferrer"
              >
                Positions on Perpl ↗
              </a>
            )}
          </section>
        )}
      </section>
    </div>
  );
}
