import { z } from "zod";
import { detectedPostSchema } from "./signals";

export type {
  CallView,
  CreatorWorkspaceView,
  DataState,
  FillView,
  PreparedTradeView,
} from "./view-models";

export const chainIdSchema = z.union([z.literal(10143), z.literal(143)]);
export type MonadChainId = z.infer<typeof chainIdSchema>;
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const amountSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
export const bindingChallengeRequestSchema = z
  .object({ wallet: addressSchema })
  .strict();
export const bindingProofSchema = z
  .object({
    challengeId: z.uuid(),
    signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  })
  .strict();
export const identityBindingSchema = z.object({
  xUserId: z.string().regex(/^[0-9]+$/),
  handle: z.string().regex(/^[a-z0-9_]{1,15}$/),
  wallet: addressSchema,
  linkedAt: z.iso.datetime(),
});
export const bindingChallengeSchema = z.object({
  challengeId: z.uuid(),
  message: z.string().min(1).max(2048),
  wallet: addressSchema,
  expiresAt: z.iso.datetime(),
});
export const identityStatusSchema = z.object({
  xAccount: z
    .object({ xUserId: z.string().regex(/^[0-9]+$/), handle: z.string() })
    .nullable(),
  binding: identityBindingSchema.nullable(),
  bindingCurrent: z.boolean(),
});
export const xHandleSchema = z.string().regex(/^[A-Za-z0-9_]{1,15}$/);

export const creatorSchema = z.object({
  xUserId: z.string().regex(/^[0-9]+$/),
  handle: xHandleSchema,
  wallet: addressSchema.nullable(),
  identity: z.enum(["unlinked", "linked"]),
  stake: z
    .object({
      amount: amountSchema,
      token: addressSchema,
      chainId: chainIdSchema,
      withdrawalRequestedAt: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  reputation: z.object({
    score: z.number().min(0).max(100).nullable(),
    scoredCalls: z.number().int().nonnegative(),
    indexedPosts: z.number().int().nonnegative(),
    methodologyVersion: z.string(),
  }),
});
export type Creator = z.infer<typeof creatorSchema>;

export const tradeIntentSchema = z.object({
  chainId: chainIdSchema,
  market: addressSchema,
  side: z.enum(["buy", "sell"]),
  amount: amountSchema.refine(
    (value) => BigInt(value) > 0n,
    "Amount must be positive",
  ),
  source: z.object({
    postId: z.string().regex(/^[0-9]+$/),
    creatorXUserId: z.string().regex(/^[0-9]+$/),
  }),
});
export type TradeIntent = z.infer<typeof tradeIntentSchema>;

export function hasActiveStake(
  balance: bigint,
  minimum: bigint,
  withdrawalPending: boolean,
): boolean {
  return minimum > 0n && balance >= minimum && !withdrawalPending;
}

export function normalizeHandle(input: string): string | null {
  const result = xHandleSchema.safeParse(input.replace(/^@/, ""));
  return result.success ? result.data.toLowerCase() : null;
}

export const sponsorNames = [
  "Kuru",
  "Privy",
  "Envio",
  "Nansen",
  "Perpl",
  "Chainlink CRE",
] as const;
export type SponsorName = (typeof sponsorNames)[number];
export type IntegrationStatus = {
  name: SponsorName;
  configured: boolean;
  implementation: "foundation";
  detail: string;
};

const indexedTimestampSchema = amountSchema.refine(
  (value) => BigInt(value) <= 253402300799n,
  "Timestamp outside supported date range",
);
export const indexedStakeSchema = z.object({
  status: z.enum(["current", "lagging", "unavailable"]),
  observedAt: z.iso.datetime(),
  progressBlock: amountSchema.optional(),
  progressBlockTime: z.string().optional(),
  events: z
    .array(
      z.object({
        id: z.string().regex(/^10143:[0-9]+:[0-9]+$/),
        balance: amountSchema,
        withdrawableAt: indexedTimestampSchema,
        blockNumber: amountSchema,
        timestamp: indexedTimestampSchema,
      }),
    )
    .max(20),
});
export const publicCreatorEvidenceSchema = z.object({
  handle: xHandleSchema,
  identity: z.object({
    status: z.enum(["bound", "unavailable"]),
    xUserId: z
      .string()
      .regex(/^[0-9]+$/)
      .optional(),
    wallet: addressSchema.optional(),
    linkedAt: z.iso.datetime().optional(),
  }),
  stake: z.object({
    status: z.enum(["active", "inactive", "withdrawal-pending", "unavailable"]),
    chainId: z.literal(10143),
    contract: addressSchema.optional(),
    token: addressSchema.optional(),
    symbol: z.enum(["USDC", "mUSDC"]).optional(),
    balance: amountSchema.optional(),
    withdrawableAt: amountSchema.optional(),
    indexing: indexedStakeSchema.optional(),
  }),
  observedAt: z.iso.datetime(),
});
export type PublicCreatorEvidence = z.infer<typeof publicCreatorEvidenceSchema>;
export const stakeStateSchema = z.object({
  chainId: z.literal(10143),
  wallet: addressSchema,
  token: addressSchema,
  decimals: z.literal(6),
  symbol: z.enum(["USDC", "mUSDC"]),
  contract: addressSchema.nullable(),
  minimum: amountSchema,
  cooldown: amountSchema,
  balance: amountSchema,
  allowance: amountSchema,
  tokenBalance: amountSchema,
  nativeBalance: amountSchema,
  withdrawableAt: amountSchema,
  faucetClaimed: z.boolean().optional(),
  blockNumber: amountSchema,
  blockHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  blockTimestamp: amountSchema,
  observedAt: z.iso.datetime(),
  finality: z.literal("latest-unfinalized"),
  indexing: indexedStakeSchema.optional(),
});
export const stakeActionSchema = z
  .object({
    action: z.enum([
      "deploy",
      "deployMockUSDC",
      "faucet",
      "deposit",
      "requestWithdrawal",
      "cancelWithdrawal",
      "withdraw",
    ]),
    amount: z.string().max(100).optional(),
  })
  .strict();
export const preparedStakeSchema = z.object({
  action: z.enum([
    "deploy",
    "deployMockUSDC",
    "faucet",
    "deposit",
    "approve",
    "resetAllowance",
    "requestWithdrawal",
    "cancelWithdrawal",
    "withdraw",
  ]),
  chainId: z.literal(10143),
  wallet: addressSchema,
  to: addressSchema.nullable(),
  data: z.string().regex(/^0x[0-9a-fA-F]+$/),
  value: z.literal("0"),
  gas: amountSchema,
  expiresAt: z.iso.datetime(),
  state: stakeStateSchema,
});

const callAssets = ["BTC", "ETH", "SOL", "MON"] as const;
const signedIntegerSchema = z.string().regex(/^-?(0|[1-9][0-9]*)$/);
export const callRegistrationSchema = z
  .object({
    postUrl: z.string().max(200),
    asset: z.enum(callAssets),
    direction: z.enum(["up", "down"]),
    horizon: z.enum(["24h", "7d", "30d"]),
    // Minimum move in basis points; 1 means any move in the called direction.
    targetBps: z.number().int().min(1).max(10000),
  })
  .strict();
export const priceObservationSchema = z.object({
  assetId: z.enum(callAssets),
  sourceId: z.string(),
  price: amountSchema,
  priceDecimals: z.number().int().min(0).max(36),
  timestamp: amountSchema,
});
export const callEvidenceSchema = z.object({
  post: z.object({
    authorHandle: xHandleSchema,
    text: z.string().max(1000),
    verifiedAt: z.iso.datetime(),
  }),
  horizon: z.enum(["24h", "7d", "30d"]),
  terms: z.object({
    methodology: z.literal("directional-return-v1"),
    assetId: z.enum(callAssets),
    sourceId: z.string(),
    direction: z.enum(["up", "down"]),
    entryPrice: amountSchema,
    priceDecimals: z.number().int().min(0).max(36),
    expiry: amountSchema,
    toleranceSeconds: amountSchema,
    targetBps: amountSchema,
  }),
  entry: priceObservationSchema,
  exit: priceObservationSchema.nullable(),
  outcome: z.enum(["success", "failure", "tie"]).nullable(),
  returnBps: signedIntegerSchema.nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
});
export type CallEvidence = z.infer<typeof callEvidenceSchema>;
export const bondOutcomes = [
  "open",
  "success",
  "failure",
  "tie",
  "refunded",
] as const;
/** CallSettlement state as indexed by Envio; prices use 8 decimals. */
export const indexedCallBondSchema = z.object({
  contract: addressSchema,
  status: z.enum(bondOutcomes),
  bond: amountSchema,
  reward: amountSchema,
  start: amountSchema,
  expiry: amountSchema,
  entryPrice: amountSchema.nullable(),
  exitPrice: amountSchema.nullable(),
  payout: amountSchema.nullable(),
  registeredTx: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  settledTx: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .nullable(),
});
export type IndexedCallBond = z.infer<typeof indexedCallBondSchema>;
export const publicCallSchema = z.object({
  id: z.uuid(),
  postId: z.string().regex(/^[0-9]+$/),
  sourceUrl: z.url(),
  publishedAt: z.iso.datetime(),
  registeredAt: z.iso.datetime(),
  status: z.enum(["open", "resolved"]),
  evidence: callEvidenceSchema,
  bond: indexedCallBondSchema.nullable().optional(),
});
export type PublicCall = z.infer<typeof publicCallSchema>;
export const publicCallLedgerSchema = z.object({
  handle: xHandleSchema,
  methodology: z.literal("directional-return-v1"),
  calls: z.array(publicCallSchema),
  // Bonds come from Envio; "unavailable" means unknown, not unbonded.
  bonds: z
    .object({
      status: z.enum(["indexed", "unavailable", "unconfigured"]),
      progressBlock: amountSchema.nullable(),
    })
    .optional(),
  observedAt: z.iso.datetime(),
});
export * from "./signals";
export * from "./watchlist";

const txHashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const indexedIdSchema = z.string().regex(/^10143:[0-9]+:[0-9]+$/);
export const kuruActivitySchema = z.object({
  status: z.enum(["current", "lagging", "unavailable"]),
  observedAt: z.iso.datetime(),
  progressBlock: amountSchema.nullable(),
  headBlock: amountSchema.nullable(),
  accountIds: z.array(amountSchema).max(20),
  swaps: z
    .array(
      z.object({
        id: indexedIdSchema,
        market: z.enum(["WETH", "WBTC", "MON"]),
        side: z.enum(["buy", "sell"]),
        amountIn: amountSchema,
        amountOut: amountSchema,
        minAmountOut: amountSchema,
        blockNumber: amountSchema,
        timestamp: amountSchema,
        transactionHash: txHashSchema,
        // User-supplied when the trade was placed; not verified against the post.
        sourcePostId: z
          .string()
          .regex(/^[0-9]{1,30}$/)
          .nullable(),
      }),
    )
    .max(50),
  transfers: z
    .array(
      z.object({
        id: indexedIdSchema,
        kind: z.enum(["deposit", "withdrawal"]),
        token: z.enum(["USDC", "WETH", "WBTC", "MON"]),
        amount: amountSchema,
        blockNumber: amountSchema,
        timestamp: amountSchema,
        transactionHash: txHashSchema,
      }),
    )
    .max(50),
});
export type KuruActivity = z.infer<typeof kuruActivitySchema>;
export const recordTradeSchema = z
  .object({
    transactionHash: txHashSchema,
    sourcePostId: z.string().regex(/^[0-9]{1,30}$/),
  })
  .strict();

// Public reachability is not a deletion verdict or a settlement signal.
export const postAvailabilitySchema = z.object({
  status: z.enum(["available", "not-publicly-available", "unavailable"]),
  source: z.literal("x-oembed"),
  checkedAt: z.iso.datetime(),
});
export type PostAvailability = z.infer<typeof postAvailabilitySchema>;

export const creatorOverviewSchema = z.object({
  handle: xHandleSchema,
  observedAt: z.iso.datetime(),
  callsStatus: z.enum(["ready", "unavailable", "untracked"]),
  ongoingCalls: z.array(publicCallSchema).max(50),
  expiredUnresolved: z.number().int().nonnegative(),
  activity: kuruActivitySchema.nullable(),
  positionsNote: z.string(),
  detectedPosts: z.array(detectedPostSchema).max(10).default([]),
  detectedPostsStatus: z.enum(["ready", "unavailable"]).default("unavailable"),
  // Trades users recorded against this creator's posts. The post link is user-supplied;
  // no profit or loss is computed from it.
  followerTrades: z
    .object({
      status: z.enum(["ready", "unavailable"]),
      recorded: z.number().int().nonnegative(),
      submitted: z.number().int().nonnegative(),
      posts: z.number().int().nonnegative(),
    })
    .default({ status: "unavailable", recorded: 0, submitted: 0, posts: 0 }),
});
export type CreatorOverview = z.infer<typeof creatorOverviewSchema>;

export const browserFollowSchema = z.object({
  handle: xHandleSchema,
  observedAt: z.iso.datetime(),
});
export const browserFollowingSchema = z.object({
  viewerHandle: xHandleSchema,
  enabled: z.boolean(),
  follows: z.array(browserFollowSchema).max(500),
  coverage: z.literal("viewed-only"),
});
export type BrowserFollowing = z.infer<typeof browserFollowingSchema>;

/** Opt-in onchain bond for a registered call, settled by the Chainlink CRE workflow. */
const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const callBondStateSchema = z.object({
  callId: z.uuid(),
  onchainId: bytes32Schema,
  chainId: z.literal(10143),
  contract: addressSchema,
  token: addressSchema,
  wallet: addressSchema,
  bondable: z.boolean(),
  reason: z.string().nullable(),
  horizon: amountSchema.nullable(),
  minBond: amountSchema,
  maxBond: amountSchema,
  rewardPool: amountSchema,
  tokenBalance: amountSchema,
  allowance: amountSchema,
  nativeBalance: amountSchema,
  claimable: amountSchema,
  refundableAt: amountSchema.nullable(),
  onchain: z
    .object({
      status: z.enum(bondOutcomes),
      bond: amountSchema,
      reward: amountSchema,
      start: amountSchema,
      expiry: amountSchema,
      entryPrice: amountSchema,
      exitPrice: amountSchema,
    })
    .nullable(),
  blockNumber: amountSchema,
  blockTimestamp: amountSchema,
  observedAt: z.iso.datetime(),
});
export type CallBondState = z.infer<typeof callBondStateSchema>;
export const callBondActionSchema = z.object({
  action: z.enum(["bond", "claim", "refund"]),
  // Whole mUSDC; the contract enforces its own bounds.
  amount: z
    .string()
    .regex(/^[1-9][0-9]{0,3}$/)
    .optional(),
});
export const preparedCallBondSchema = z.object({
  action: z.enum(["approve", "register", "claim", "refund"]),
  chainId: z.literal(10143),
  wallet: addressSchema,
  to: addressSchema,
  data: z.string().regex(/^0x[0-9a-fA-F]+$/),
  value: z.literal("0"),
  gas: amountSchema,
  expiresAt: z.iso.datetime(),
  bond: amountSchema.nullable(),
  reward: amountSchema.nullable(),
  termsHash: bytes32Schema.nullable(),
  state: callBondStateSchema,
});

export type { InlineQuote } from "./inline-trade";
export {
  decimalAtoms,
  displayAtoms,
  inlineQuoteRequestSchema,
  inlineQuoteSchema,
  publicPayoutSchema,
} from "./inline-trade";

export * from "./perp-ticket";
