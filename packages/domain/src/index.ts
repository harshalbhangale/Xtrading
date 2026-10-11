import { z } from "zod";

export const chainIdSchema = z.union([z.literal(10143), z.literal(143)]);
export type MonadChainId = z.infer<typeof chainIdSchema>;
export const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
export const amountSchema = z.string().regex(/^(0|[1-9][0-9]*)$/);
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

export const sponsorNames = ["Kuru", "Privy", "Envio", "Nansen"] as const;
export type SponsorName = (typeof sponsorNames)[number];
export type IntegrationStatus = {
  name: SponsorName;
  configured: boolean;
  implementation: "foundation";
  detail: string;
};
