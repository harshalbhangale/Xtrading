import { z } from "zod";

// Methodology versions are stored with every classification so results stay traceable.
export const signalMethodologyVersion = "signal-v1";

const postIdSchema = z.string().regex(/^[0-9]{1,30}$/);
const handleSchema = z.string().regex(/^[a-z0-9_]{1,15}$/);
const symbolSchema = z.string().regex(/^[A-Z0-9]{1,12}$/);

export const postSignalRequestSchema = z
  .object({
    postId: postIdSchema,
    handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
    // X caps posts well below this; longer input is rejected rather than truncated.
    text: z.string().min(1).max(2000),
  })
  .strict();
export type PostSignalRequest = z.infer<typeof postSignalRequestSchema>;

/** What the post says. Extraction only: never a recommendation or an outcome. */
export const postSignalSchema = z.object({
  postId: postIdSchema,
  handle: handleSchema,
  isCall: z.boolean(),
  confidence: z.enum(["low", "medium", "high"]),
  asset: symbolSchema.nullable(),
  direction: z.enum(["bullish", "bearish"]).nullable(),
  // "perp" only when the post explicitly mentions leverage, longs/shorts or perps.
  instrument: z.enum(["spot", "perp"]).nullable(),
  leverage: z.number().int().min(1).max(200).nullable(),
  horizon: z.string().max(60).nullable(),
  summary: z.string().max(280),
  source: z.enum(["llm", "heuristic"]),
  model: z.string().max(64).nullable(),
  methodologyVersion: z.literal(signalMethodologyVersion),
  classifiedAt: z.iso.datetime(),
});
export type PostSignal = z.infer<typeof postSignalSchema>;

export const tradeRouteSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    venue: z.enum(["Kuru", "Perpl"]),
    instrument: z.enum(["spot", "perp"]),
    // Null when the post names an asset but no direction; the reviewer chooses.
    side: z.enum(["buy", "sell", "long", "short"]).nullable(),
    market: z.string().max(40),
    marketId: z.string().max(80),
    note: z.string().max(240),
  }),
  z.object({
    status: z.literal("unavailable"),
    reason: z.string().max(240),
  }),
]);
export type TradeRoute = z.infer<typeof tradeRouteSchema>;

export const providerModeSchema = z.enum(["live", "demo", "unavailable"]);

export const postSignalResponseSchema = z.object({
  signal: postSignalSchema,
  route: tradeRouteSchema,
  llm: providerModeSchema,
});

export const nansenFindingSchema = z.object({
  kind: z.enum(["sold-asset", "bought-asset", "no-activity", "note"]),
  summary: z.string().max(300),
  transactionHash: z.string().max(100).nullable(),
  observedAt: z.string().max(40).nullable(),
});

export const nansenCheckSchema = z.object({
  mode: providerModeSchema,
  verdict: z.enum([
    "contradiction",
    "consistent",
    "no-activity",
    "not-applicable",
    "unavailable",
  ]),
  wallet: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .nullable(),
  chain: z.string().max(20),
  window: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }).nullable(),
  findings: z.array(nansenFindingSchema).max(10),
  note: z.string().max(400),
  observedAt: z.iso.datetime(),
});
export type NansenCheck = z.infer<typeof nansenCheckSchema>;

export const reputationSchema = z.object({
  trackedCalls: z.number().int().nonnegative(),
  bullish: z.number().int().nonnegative(),
  bearish: z.number().int().nonnegative(),
  perpCalls: z.number().int().nonnegative(),
  evaluated: z.number().int().nonnegative(),
  // Null until calls can be evaluated against sourced expiry prices.
  score: z.number().min(0).max(100).nullable(),
  methodology: z.string().max(300),
  recent: z
    .array(
      z.object({
        postId: postIdSchema,
        asset: symbolSchema.nullable(),
        direction: z.enum(["bullish", "bearish"]).nullable(),
        instrument: z.enum(["spot", "perp"]).nullable(),
        classifiedAt: z.iso.datetime(),
      }),
    )
    .max(10),
  status: z.enum(["ready", "unavailable"]),
});
export type Reputation = z.infer<typeof reputationSchema>;
