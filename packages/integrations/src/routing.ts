import { addressSchema, chainIdSchema } from "@call-my-bluff/domain";
import { z } from "zod";

// Route only explicit, reviewed intent. A bearish call must not imply a leveraged short.
const requestSchema = z.discriminatedUnion("instrument", [
  z
    .object({
      instrument: z.literal("spot"),
      chainId: chainIdSchema,
      asset: addressSchema,
      side: z.enum(["buy", "sell"]),
    })
    .strict(),
  z
    .object({
      instrument: z.literal("perp"),
      chainId: chainIdSchema,
      asset: addressSchema,
      side: z.enum(["long", "short"]),
    })
    .strict(),
]);

export const routeMarketSchema = z
  .object({
    instrument: z.enum(["spot", "perp"]),
    chainId: chainIdSchema,
    asset: addressSchema,
    marketId: z.string().min(1).max(128),
    // Enable only after verifying the deployment, collateral, precision and liquidity.
    enabled: z.boolean(),
  })
  .strict();

export type RouteMarket = z.infer<typeof routeMarketSchema>;

export function resolveTradeRoute(
  input: unknown,
  configuration: RouteMarket[],
) {
  const request = requestSchema.parse(input);
  const markets = z.array(routeMarketSchema).parse(configuration);
  const matches = markets.filter(
    (market) =>
      market.chainId === request.chainId &&
      market.instrument === request.instrument &&
      market.asset.toLowerCase() === request.asset.toLowerCase(),
  );
  if (matches.length > 1) throw new Error("Ambiguous market configuration");
  const market = matches[0];
  if (!market?.enabled) return { status: "unavailable" as const };
  return {
    status: "route-only" as const,
    venue:
      request.instrument === "spot" ? ("Kuru" as const) : ("Perpl" as const),
    chainId: request.chainId,
    marketId: market.marketId,
    side: request.side,
  };
}
