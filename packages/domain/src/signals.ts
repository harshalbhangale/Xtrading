import { z } from "zod";

// Methodology versions are stored with every classification so results stay traceable.
export const signalMethodologyVersion = "signal-v1";

const postIdSchema = z.string().regex(/^[0-9]{1,30}$/);
const handleSchema = z.string().regex(/^[a-z0-9_]{1,15}$/);
const symbolSchema = z.string().regex(/^[A-Z0-9]{1,12}$/);

export const postImageSchema = z.object({
  url: z
    .string()
    .max(300)
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        url.hostname === "pbs.twimg.com" &&
        !url.username &&
        !url.password &&
        !url.port &&
        /^\/media\/[A-Za-z0-9_-]+(?:\.(?:jpg|jpeg|png|webp))?$/.test(
          url.pathname,
        )
      );
    }, "Only X post images are accepted"),
  alt: z.string().max(120),
});
export const tokenReferenceSchema = z.object({
  address: z.string().max(44),
  kind: z.enum(["evm", "solana"]),
});

export const postSignalRequestSchema = z
  .object({
    postId: postIdSchema,
    handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
    // X caps posts well below this; longer input is rejected rather than truncated.
    text: z.string().min(1).max(2000),
    images: z.array(postImageSchema).max(4).default([]),
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
  capturedText: z.string().max(2000).optional(),
  source: z.enum(["llm", "heuristic"]),
  model: z.string().max(64).nullable(),
  methodologyVersion: z.literal(signalMethodologyVersion),
  classifiedAt: z.iso.datetime(),
  images: z.array(postImageSchema).max(4).default([]),
  tokenReferences: z.array(tokenReferenceSchema).max(4).default([]),
  tokenMention: z.boolean().default(false),
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

export const detectedPostSchema = z.object({
  signal: postSignalSchema,
  route: tradeRouteSchema,
});
export type DetectedPost = z.infer<typeof detectedPostSchema>;

/** A review link only. It cannot sign or submit an order. */
export function tradeReviewPath(
  signal: PostSignal,
  route: TradeRoute,
  side?: "buy" | "sell",
) {
  if (route.status !== "available" || signal.tokenReferences.length)
    return null;
  const params = new URLSearchParams({
    instrument: route.instrument,
    chainId: "10143",
    postId: signal.postId,
    handle: signal.handle,
  });
  const chosen = side
    ? route.instrument === "perp"
      ? side === "buy"
        ? "long"
        : "short"
      : side
    : route.side;
  if (chosen) params.set("side", chosen);
  if (signal.asset) params.set("asset", signal.asset);
  if (signal.direction) params.set("direction", signal.direction);
  params.set(route.venue === "Kuru" ? "market" : "marketId", route.marketId);
  if (route.venue === "Perpl" && signal.leverage)
    params.set("leverage", String(Math.min(signal.leverage, 50)));
  return `/dashboard/trade?${params}`;
}

export const providerModeSchema = z.enum(["live", "demo", "unavailable"]);

export const postSignalResponseSchema = z.object({
  signal: postSignalSchema,
  route: tradeRouteSchema,
  llm: providerModeSchema,
});

export const nansenFindingSchema = z.object({
  kind: z.enum([
    "sold-asset",
    "bought-asset",
    "no-activity",
    "note",
    // Positioned with the call before posting, then exited against it after.
    "front-run",
    "perp-long",
    "perp-short",
  ]),
  summary: z.string().max(300),
  transactionHash: z.string().max(100).nullable(),
  observedAt: z.string().max(40).nullable(),
  // Nansen chain name, or "hyperliquid" for perp trades.
  chain: z.string().max(20).nullable().optional(),
  // Whether this trade went with or against the stated direction.
  stance: z.enum(["with", "against"]).nullable().optional(),
  valueUsd: z.number().finite().nullable().optional(),
});

/** One Nansen request made (or deliberately skipped) for this check. */
export const nansenSourceSchema = z.object({
  endpoint: z.string().max(60),
  chain: z.string().max(20).nullable(),
  status: z.enum(["ok", "empty", "failed", "skipped"]),
  note: z.string().max(160).nullable(),
});
export type NansenSource = z.infer<typeof nansenSourceSchema>;

/** Observations about the token or wallet. "caution" is still not proof of intent. */
export const nansenFlagSchema = z.object({
  kind: z.enum([
    "holder-concentration",
    "smart-money-exit",
    "whale-exit",
    "fresh-wallet-inflow",
    "creator-sold-after-call",
    "linked-wallet-sold",
    "creator-took-profit",
    "young-token",
    "thin-liquidity",
  ]),
  severity: z.enum(["info", "caution"]),
  summary: z.string().max(300),
});
export type NansenFlag = z.infer<typeof nansenFlagSchema>;

const usd = z.number().finite().nullable();
export const nansenTokenSchema = z.object({
  chain: z.string().max(20),
  address: z.string().max(64),
  symbol: z.string().max(24).nullable(),
  name: z.string().max(80).nullable(),
  // "post" when the address came from the post text; "major" for BTC/ETH/MON wrappers.
  origin: z.enum(["post", "major"]),
  marketCapUsd: usd,
  liquidityUsd: usd,
  holders: z.number().int().nonnegative().nullable(),
  deployedAt: z.string().max(40).nullable(),
  // Top 10 holders excluding labelled exchanges and pools, as % of total supply.
  topHoldersPct: z.number().finite().min(0).max(100).nullable(),
  flows: z
    .object({
      timeframe: z.string().max(4),
      smartTraderNetUsd: usd,
      whaleNetUsd: usd,
      publicFigureNetUsd: usd,
      freshWalletsNetUsd: usd,
      exchangeNetUsd: usd,
    })
    .nullable(),
  // Largest net sellers from the call time to 48 hours after.
  sellersAfterCall: z
    .array(
      z.object({
        address: z.string().max(64),
        label: z.string().max(80).nullable(),
        soldUsd: z.number().finite(),
        boughtUsd: z.number().finite(),
        isCreator: z.boolean(),
        isLinked: z.boolean(),
      }),
    )
    .max(5),
});
export type NansenToken = z.infer<typeof nansenTokenSchema>;

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
  // Post time from the X post ID; the wallet window is centred on it.
  callAt: z.iso.datetime().nullable().optional(),
  chains: z.array(z.string().max(20)).max(6).optional(),
  token: nansenTokenSchema.nullable().optional(),
  flags: z.array(nansenFlagSchema).max(10).optional(),
  // Actual wallet returns: separate from call outcomes and from identity.
  walletPnl: z
    .object({
      window: z.object({ from: z.iso.datetime(), to: z.iso.datetime() }),
      realizedUsd: usd,
      tradedTokens: z.number().int().nonnegative().nullable(),
      onToken: z
        .object({
          realizedUsd: usd,
          unrealizedUsd: usd,
          stillHoldingRatio: z.number().finite().nullable(),
        })
        .nullable(),
    })
    .nullable()
    .optional(),
  // Funding/deployment links Nansen reports. Possible links, never identity.
  related: z
    .array(
      z.object({
        address: z.string().max(64),
        label: z.string().max(80).nullable(),
        relation: z.string().max(60),
        chain: z.string().max(20),
      }),
    )
    .max(10)
    .optional(),
  sources: z.array(nansenSourceSchema).max(24).optional(),
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
  // Detected calls priced from the post's timestamp to now (unregistered, unscored).
  measured: z
    .object({
      count: z.number().int().nonnegative(),
      inFavour: z.number().int().nonnegative(),
      medianBps: z.number().int().nullable(),
      items: z
        .array(
          z.object({
            postId: postIdSchema,
            asset: symbolSchema,
            direction: z.enum(["bullish", "bearish"]),
            entryPrice: z.string(),
            nowPrice: z.string(),
            moveBps: z.number().int(),
            postedAt: z.iso.datetime(),
          }),
        )
        .max(20),
    })
    .optional(),
});
export type Reputation = z.infer<typeof reputationSchema>;
