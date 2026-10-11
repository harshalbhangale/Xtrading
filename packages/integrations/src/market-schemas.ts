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
export const prepareSpotSchema = z
  .object({
    instrument: z.literal("spot"),
    chainId: z.literal(10143),
    side: z.enum(["buy", "sell"]),
    // Integer input/output token units. No arbitrary market, target or calldata.
    amount: amountSchema.refine((value) => BigInt(value) > 0n),
    minimumOutput: amountSchema.refine((value) => BigInt(value) > 0n),
    sourcePostId: z.string().regex(/^[0-9]{1,30}$/),
  })
  .strict();
