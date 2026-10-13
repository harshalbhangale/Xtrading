"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef, useState } from "react";
import { formatUnits } from "viem";
import { z } from "zod";

const reviewSchema = z.object({
  reviewToken: z.string(),
  accountId: z.number(),
  market: z.string(),
  side: z.enum(["long", "short"]),
  size: z.string().regex(/^[0-9]+$/),
  sizeDecimals: z.number(),
  collateral: z.string().regex(/^-?[0-9]+$/),
  estimatedFee: z
    .string()
    .regex(/^[0-9]+$/)
    .nullable(),
  slippageBps: z.number(),
  expiresAt: z.string(),
  requestId: z.number(),
  note: z.string(),
});
export default function PerpCloseReview({
  positionId,
}: {
  positionId: string;
}) {
  const { getAccessToken, user } = usePrivy();
  const [review, setReview] = useState<z.infer<typeof reviewSchema> | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);
  const owner = useRef(`${user?.id}:${positionId}`);
  owner.current = `${user?.id}:${positionId}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear a private review on account or position change.
  useEffect(() => {
    setReview(null);
    setNotice("");
    setRequestId(null);
    setBusy(false);
  }, [user?.id, positionId]);
  async function call(path: string, body?: unknown) {
    const token = await getAccessToken();
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
    setReview(null);
    try {
      const value = reviewSchema.parse(
        await call("/api/trades/perp/close/prepare", {
          positionId,
          slippageBps: 50,
        }),
      );
      if (owner.current !== who) return;
      setReview(value);
    } catch (e) {
      if (owner.current !== who) return;
      setNotice(e instanceof Error ? e.message : "Close review unavailable");
    } finally {
      if (owner.current === who) setBusy(false);
    }
  }
  async function submit() {
    const who = owner.current;
    if (!review) return;
    setRequestId(review.requestId);
    setBusy(true);
    try {
      const result = z
        .object({
          status: z.enum(["submitted", "rejected", "unknown"]),
          requestId: z.number(),
          message: z.string(),
        })
        .parse(
          await call("/api/trades/perp/close/submit", {
            reviewToken: review.reviewToken,
            confirm: true,
          }),
        );
      if (owner.current !== who) return;
      setNotice(result.message);
      setRequestId(result.requestId);
      setReview(null);
    } catch (e) {
      if (owner.current !== who) return;
      setReview(null);
      setNotice(
        e instanceof Error
          ? e.message
          : "Close uncertain; check account before retrying.",
      );
    } finally {
      if (owner.current === who) setBusy(false);
    }
  }
  async function check() {
    const who = owner.current;
    if (!requestId) return;
    setBusy(true);
    try {
      const result = z
        .object({
          order: z
            .object({
              status: z.string(),
              filledSize: z.string(),
              transactionHash: z.string().nullable(),
            })
            .nullable(),
        })
        .parse(await call(`/api/trades/perp/status?rq=${requestId}`));
      if (owner.current !== who) return;
      setNotice(
        result.order
          ? `Close order: ${result.order.status}. Filled ${result.order.filledSize} base units. Refresh the account to check remaining position and collateral.`
          : "No order found yet. Do not submit another close until the outcome is known.",
      );
    } catch (e) {
      if (owner.current !== who) return;
      setNotice(e instanceof Error ? e.message : "Status unavailable");
    } finally {
      if (owner.current === who) setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button button-secondary"
        disabled={busy || requestId !== null}
        onClick={prepare}
      >
        Review full close
      </button>
      {review && (
        <section aria-label="Close position review">
          <p>
            <strong>
              Close {formatUnits(BigInt(review.size), review.sizeDecimals)}{" "}
              {review.market} {review.side}
            </strong>{" "}
            · Account #{review.accountId} · Monad testnet
          </p>
          <p>
            Current collateral {formatUnits(BigInt(review.collateral), 6)} AUSD
            · Estimated close fee{" "}
            {review.estimatedFee === null
              ? "unavailable"
              : `${formatUnits(BigInt(review.estimatedFee), 6)} AUSD`}{" "}
            · Max slippage {review.slippageBps / 100}%
          </p>
          <p>{review.note}</p>
          <p>Review expires {review.expiresAt}. No mainnet funds are used.</p>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={submit}
          >
            Confirm close on testnet
          </button>{" "}
          <button type="button" disabled={busy} onClick={() => setReview(null)}>
            Cancel
          </button>
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
      {requestId !== null && (
        <button type="button" disabled={busy} onClick={check}>
          Check close order status
        </button>
      )}
    </div>
  );
}
