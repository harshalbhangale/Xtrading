import { amountSchema } from "@call-my-bluff/domain";
import { z } from "zod";

const uint = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const perplContextSchema = z.object({
  chain: z.object({ chain_id: z.literal(10143) }),
  instances: z.array(
    z.object({ id: uint, address, collateral_token_id: uint }),
  ),
  tokens: z.array(
    z.object({ id: uint, address, symbol: z.string(), decimals: uint.max(36) }),
  ),
  markets: z.array(
    z.object({
      id: uint,
      instance_id: uint,
      symbol: z.string(),
      name: z.string().max(80).optional(),
      size_units: z.string().max(20).optional(),
      order_max_market_slippage_bps: uint.max(10_000).optional(),
      config: z.object({
        is_open: z.boolean(),
        price_decimals: uint.max(36),
        size_decimals: uint.max(36),
        // Margins are leverage-style hundredths: 1000 = 10x max (10% initial),
        // 2000 = 20x (5% maintenance). Fees are micros (10^-6 of notional).
        initial_margin: uint.max(100_000).optional(),
        maintenance_margin: uint.max(100_000).optional(),
        maker_fee: uint.max(1_000_000).optional(),
        taker_fee: uint.max(1_000_000).optional(),
      }),
      // Public market state; prices are integers scaled by price_decimals.
      state: z
        .object({
          at: z.object({ t: uint.optional() }).partial().optional(),
          mrk: uint.optional(),
          mid: uint.optional(),
          bid: uint.optional(),
          ask: uint.optional(),
          prv: uint.optional(),
        })
        .optional(),
    }),
  ),
});
const positive = amountSchema.pipe(
  z
    .string()
    .max(78)
    .refine((value) => BigInt(value) > 0n),
);
const token = z.object({
  symbol: z.string(),
  address,
  decimals: uint.max(36),
});
export const kuruMarketSchema = z.enum(["WETH", "WBTC", "MON"]);
/** Spot trading networks; each request names one explicitly. */
export const spotChainIdSchema = z.union([z.literal(10143), z.literal(143)]);
export const prepareSpotSchema = z
  .object({
    creatorXUserId: z
      .string()
      .regex(/^[0-9]{1,30}$/)
      .nullable()
      .optional(),
    instrument: z.literal("spot"),
    chainId: spotChainIdSchema,
    market: kuruMarketSchema,
    side: z.enum(["buy", "sell"]),
    // Integer input-token units. No arbitrary market, target or calldata.
    amount: positive,
    slippageBps: z.number().int().min(1).max(500),
    // User-supplied attribution; not verified against the post.
    sourcePostId: z
      .string()
      .regex(/^[0-9]{1,30}$/)
      .nullable(),
  })
  .strict();
export const prepareWithdrawSchema = z
  .object({
    chainId: z.literal(10143),
    token: z.enum(["USDC", "WETH", "WBTC", "MON"]),
    amount: positive,
  })
  .strict();

const step = {
  status: z.literal("prepared"),
  venue: z.literal("Kuru"),
  chainId: spotChainIdSchema,
  wallet: address,
  to: address,
  data: z.string().regex(/^0x[0-9a-fA-F]+$/),
  value: amountSchema,
  gas: amountSchema,
  gasPrice: amountSchema,
  nativeBalance: amountSchema,
  expiresAt: z.iso.datetime(),
  observedAt: z.iso.datetime(),
  blockNumber: amountSchema,
};
export const spotReviewSchema = z.object({
  ...step,
  instrument: z.literal("spot"),
  market: kuruMarketSchema,
  side: z.enum(["buy", "sell"]),
  action: z.enum(["approve", "deposit", "swap"]),
  amount: amountSchema,
  input: token,
  output: token,
  walletBalance: amountSchema,
  accountBalance: amountSchema,
  // Display-only estimate from resting book levels, after the taker fee.
  indicativeOutput: amountSchema.nullable(),
  indicativeFilled: z.boolean(),
  // Simulated swap result; only present for the swap step.
  amountInUsed: amountSchema.nullable(),
  expectedOutput: amountSchema.nullable(),
  minimumOutput: amountSchema.nullable(),
  deadline: amountSchema.nullable(),
  creatorFee: z
    .object({
      xUserId: z.string(),
      wallet: address,
      bps: z.literal(50),
      version: z.number().int().positive(),
      denomination: token,
    })
    .nullable()
    .default(null),
  execution: z.enum(["orderbook", "creator-flow"]).default("orderbook"),
  takerFeePps: amountSchema,
  sourcePostId: z.string().nullable(),
  slippageBps: z.number().int().min(1).max(500),
});
export const withdrawReviewSchema = z.object({
  ...step,
  action: z.literal("withdraw"),
  token,
  amount: amountSchema,
});
export const kuruAccountSchema = z.object({
  chainId: spotChainIdSchema,
  wallet: address,
  rootAccountId: amountSchema,
  balances: z.array(
    z.object({ token, account: amountSchema, wallet: amountSchema }),
  ),
  nativeBalance: amountSchema,
  observedAt: z.iso.datetime(),
  blockNumber: amountSchema,
});
