import { z } from "zod";
import { creatorFeeBpsSchema } from "./reputation";

const atoms = z.string().regex(/^(0|[1-9][0-9]{0,77})$/);
export const inlineQuoteRequestSchema = z
  .object({
    chainId: z.union([z.literal(10143), z.literal(143)]),
    market: z.enum(["MON", "WETH", "WBTC"]),
    side: z.enum(["buy", "sell"]),
    amount: atoms.pipe(z.string().refine((v) => BigInt(v) > 0n)),
    slippageBps: z.number().int().min(1).max(500),
  })
  .strict();
const token = z.object({
  symbol: z.string(),
  decimals: z.number().int().min(0).max(36),
});
export const inlineQuoteSchema = z.object({
  chainId: z.union([z.literal(10143), z.literal(143)]),
  market: z.enum(["MON", "WETH", "WBTC"]),
  side: z.enum(["buy", "sell"]),
  amount: atoms,
  input: token,
  output: token,
  expectedOutput: atoms.nullable(),
  price: z.string().nullable(),
  filled: z.boolean(),
  observedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  blockNumber: atoms,
  kind: z.literal("indicative"),
  note: z.string(),
});
export type InlineQuote = z.infer<typeof inlineQuoteSchema>;

/** Decimal parsing for transaction amounts: reject excess precision instead of rounding. */
export function decimalAtoms(value: string, decimals: number): string | null {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;
  const match = value.match(/^(0|[1-9][0-9]{0,38})(?:\.([0-9]+))?$/);
  if (!match || (match[2]?.length ?? 0) > decimals) return null;
  const result = BigInt(match[1] + (match[2] ?? "").padEnd(decimals, "0"));
  return result > 0n ? result.toString() : null;
}
export function displayAtoms(value: string, decimals: number): string {
  const padded = value.padStart(decimals + 1, "0");
  if (!decimals) return padded;
  const fraction = padded.slice(-decimals).slice(0, 6).replace(/0+$/, "");
  return `${padded.slice(0, -decimals)}${fraction ? `.${fraction}` : ""}`;
}

export const publicPayoutSchema = z.object({
  creator: z
    .object({
      xUserId: z.string().regex(/^[0-9]{1,30}$/),
      handle: z.string().regex(/^[a-z0-9_]{1,15}$/),
      wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      enabled: z.literal(true),
    })
    .nullable(),
  mainnetFeesEnabled: z.boolean(),
  bps: creatorFeeBpsSchema,
});

const decimalText = z.string().regex(/^[0-9]+(\.[0-9]+)?$/);
/** Display-only market prices for inline cards; never used for transaction amounts. */
export const spotPriceSchema = z.object({
  asset: z.enum(["MON", "ETH", "BTC"]),
  price: decimalText,
  change24hPct: z
    .string()
    .regex(/^-?[0-9]+(\.[0-9]+)?$/)
    .nullable(),
  sparkline: z.array(decimalText).max(48),
  source: z.literal("kuru-mainnet"),
  sparklineSource: z.enum(["kuru-book-1h", "binance-1h"]).nullable(),
  lastTradeAt: z.iso.datetime().nullable(),
});
export const spotPricesSchema = z.object({
  prices: z.array(spotPriceSchema).max(3),
  observedAt: z.iso.datetime(),
});
export type SpotPrice = z.infer<typeof spotPriceSchema>;
