import { z } from "zod";

const integer = z.string().regex(/^(0|[1-9][0-9]*)$/);
const positive = integer.refine((value) => BigInt(value) > 0n);
const termsSchema = z
  .object({
    methodology: z.literal("directional-return-v1"),
    assetId: z.string().min(1),
    sourceId: z.string().min(1),
    direction: z.enum(["up", "down"]),
    entryPrice: positive,
    priceDecimals: z.number().int().min(0).max(36),
    expiry: positive,
    // Proposed rule: first historical observation at/after expiry within this window.
    toleranceSeconds: integer,
    targetBps: positive,
  })
  .strict();
const observationSchema = z
  .object({
    assetId: z.string().min(1),
    sourceId: z.string().min(1),
    price: positive,
    priceDecimals: z.number().int().min(0).max(36),
    timestamp: positive,
  })
  .strict();

// Pure evaluation only; callers must verify provenance and the onchain terms commitment.
export function evaluateExpiredCall(
  termsInput: unknown,
  observationInput: unknown,
  cutoffInput: string,
) {
  const terms = termsSchema.parse(termsInput);
  const cutoff = BigInt(integer.parse(cutoffInput));
  const expiry = BigInt(terms.expiry);
  if (cutoff < expiry)
    return { outcome: "unresolved" as const, reason: "not-expired" };
  const parsed = observationSchema.safeParse(observationInput);
  if (!parsed.success)
    return { outcome: "unresolved" as const, reason: "missing-price" };
  const observation = parsed.data;
  const timestamp = BigInt(observation.timestamp);
  if (
    observation.assetId !== terms.assetId ||
    observation.sourceId !== terms.sourceId ||
    observation.priceDecimals !== terms.priceDecimals ||
    timestamp < expiry ||
    timestamp > expiry + BigInt(terms.toleranceSeconds) ||
    timestamp > cutoff
  ) {
    return { outcome: "unresolved" as const, reason: "invalid-observation" };
  }
  const entry = BigInt(terms.entryPrice);
  const change =
    terms.direction === "up"
      ? BigInt(observation.price) - entry
      : entry - BigInt(observation.price);
  if (change === 0n) return { outcome: "tie" as const };
  return {
    outcome:
      change * 10000n >= entry * BigInt(terms.targetBps)
        ? ("success" as const)
        : ("failure" as const),
  };
}
