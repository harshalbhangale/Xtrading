import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const uint = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const closeReviewSchema = z
  .object({
    accountId: uint,
    positionId: z.string().regex(/^[0-9]+$/),
    marketId: uint,
    side: z.enum(["long", "short"]),
    size: z.string().regex(/^[1-9][0-9]*$/),
    leverageHundredths: uint,
    slippageBps: uint.min(1).max(500),
    requestId: uint.min(1),
    expiresAt: uint,
    owner: z.string().min(1),
  })
  .strict();
export type CloseReview = z.infer<typeof closeReviewSchema>;
export function signCloseReview(review: CloseReview, secret: string) {
  const payload = Buffer.from(
    JSON.stringify(closeReviewSchema.parse(review)),
  ).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;
}
export function verifyCloseReview(
  token: string,
  secret: string,
  owner: string,
  now = Date.now(),
) {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length || token.length > 4096)
    throw new Error("invalid_close_review");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  )
    throw new Error("invalid_close_review");
  const review = closeReviewSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString()),
  );
  if (
    review.owner !== owner ||
    review.expiresAt <= now ||
    review.expiresAt > now + 65000
  )
    throw new Error("expired_close_review");
  return review;
}
/** CloseLong/CloseShort can only reduce the matching side, never open the opposite side. */
export function buildPerplCloseOrder(review: CloseReview) {
  const r = closeReviewSchema.parse(review);
  if (BigInt(r.size) > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("size_too_large");
  return {
    rq: r.requestId,
    mkt: r.marketId,
    acc: r.accountId,
    t: r.side === "long" ? 3 : 4,
    p: 0,
    s: Number(r.size),
    ms: r.slippageBps,
    fl: 4,
    lv: r.leverageHundredths,
    lb: 0,
  };
}
