"use client";
import { formatUsd, fromUnits } from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { type PerplChainId, usePerplSteps } from "./use-perpl-steps";
import { useTradingWallet, walletHeader } from "./use-trading-wallet";

const integer = z.string().regex(/^[0-9]+$/);
const step = z.object({
  kind: z.literal("order"),
  label: z.string(),
  to: z.custom<`0x${string}`>(
    (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v),
  ),
  data: z.custom<`0x${string}`>(
    (v) => typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v),
  ),
});
const reviewSchema = z.object({
  wallet: z.string(),
  market: z.string(),
  side: z.enum(["long", "short"]),
  size: integer,
  sizeDecimals: z.number(),
  priceDecimals: z.number(),
  limitPrice: integer,
  slippageBps: z.number(),
  requestId: integer,
  steps: z.array(step).length(1),
  note: z.string(),
  expiresAt: z.string(),
});
const resultSchema = z.object({
  status: z.enum(["filled", "partially-filled", "not-filled", "reverted"]),
  filledSize: integer.optional(),
  message: z.string(),
  transactionHash: z.string(),
});

/** Full, reduce-only close of one of the user's own positions, signed by their wallet. */
export default function PerpCloseReview({
  chainId,
  marketId,
  onDone,
}: {
  chainId: PerplChainId;
  marketId: number;
  onDone: () => void;
}) {
  const { getAccessToken, user } = usePrivy();
  const tradingWallet = useTradingWallet();
  const runSteps = usePerplSteps(chainId);
  const [review, setReview] = useState<z.infer<typeof reviewSchema> | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = useRef(`${user?.id}:${marketId}`);
  owner.current = `${user?.id}:${marketId}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear a private review on account or position change.
  useEffect(() => {
    setReview(null);
    setNotice("");
    setBusy(false);
  }, [user?.id, marketId]);
  async function call(path: string, body: unknown) {
    const token = await getAccessToken();
    const response = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...walletHeader(tradingWallet),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        typeof data.error === "string"
          ? data.error.replaceAll("_", " ")
          : "Close unavailable",
      );
    return data;
  }
  async function prepare() {
    const who = owner.current;
    setBusy(true);
    setNotice("");
    try {
      const value = reviewSchema.parse(
        await call("/api/trades/perp/close/prepare", {
          chainId,
          marketId,
          slippageBps: 50,
        }),
      );
      if (owner.current === who) setReview(value);
    } catch (e) {
      if (owner.current === who)
        setNotice(e instanceof Error ? e.message : "Close unavailable");
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (!review) return;
    if (Date.parse(review.expiresAt) <= Date.now()) {
      setReview(null);
      setNotice("Review expired. Review the close again.");
      return;
    }
    const who = owner.current;
    setBusy(true);
    try {
      const hashes = await runSteps(review.wallet, review.steps, (text) => {
        if (owner.current === who) setNotice(text);
      });
      const result = resultSchema.parse(
        await call("/api/trades/perp/confirm", {
          chainId,
          transactionHash: hashes.order,
          requestId: review.requestId,
          sourcePostId: null,
        }),
      );
      if (owner.current !== who) return;
      setReview(null);
      setNotice(
        `${result.status.replace("-", " ")}: ${result.message} ${result.transactionHash.slice(0, 10)}…`,
      );
      onDone();
    } catch (e) {
      if (owner.current === who)
        setNotice(e instanceof Error ? e.message : "Close failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="perp-close">
      {!review ? (
        <button
          className="button secondary-button"
          type="button"
          disabled={busy}
          onClick={() => void prepare()}
        >
          {busy ? "Checking…" : "Review full close"}
        </button>
      ) : (
        <div className="perp-close-review">
          <p>
            Close {review.side}{" "}
            {fromUnits(BigInt(review.size), review.sizeDecimals)}{" "}
            {review.market} · limit{" "}
            {formatUsd(BigInt(review.limitPrice), review.priceDecimals)} (mark ±{" "}
            {(review.slippageBps / 100).toFixed(2)}%)
          </p>
          <p className="small-note">{review.note}</p>
          <button
            className="button"
            type="button"
            disabled={busy}
            onClick={() => void sign()}
          >
            {busy ? "Waiting for wallet…" : "Sign close in wallet"}
          </button>{" "}
          <button
            className="button secondary-button"
            type="button"
            disabled={busy}
            onClick={() => setReview(null)}
          >
            Back
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
