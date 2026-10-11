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
      config: z.object({
        is_open: z.boolean(),
        price_decimals: uint.max(36),
        size_decimals: uint.max(36),
      }),
    }),
  ),
});
const positive = amountSchema.refine((value) => BigInt(value) > 0n);
const token = z.object({
  symbol: z.string(),
  address,
  decimals: uint.max(36),
});
export const kuruMarketSchema = z.enum(["WETH", "WBTC"]);
export const prepareSpotSchema = z
  .object({
    instrument: z.literal("spot"),
    chainId: z.literal(10143),
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
    token: z.enum(["USDC", "WETH", "WBTC"]),
    amount: positive,
  })
  .strict();

const step = {
  status: z.literal("prepared"),
  venue: z.literal("Kuru"),
  chainId: z.literal(10143),
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
  chainId: z.literal(10143),
  wallet: address,
  rootAccountId: amountSchema,
  balances: z.array(
    z.object({ token, account: amountSchema, wallet: amountSchema }),
  ),
  nativeBalance: amountSchema,
  observedAt: z.iso.datetime(),
  blockNumber: amountSchema,
});
