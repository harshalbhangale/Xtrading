import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  buildPerplOpenOrder,
  signPerplRequest,
} from "@call-my-bluff/integrations/perpl";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import { z } from "zod";
import { identityContext } from "./identity-http";
import { perplSnapshot } from "./markets";
import { allow } from "./rate-limit";

export const perpRequestSchema = z
  .object({
    marketId: z.number().int().nonnegative(),
    side: z.enum(["long", "short"]),
    // Human decimal size in the market's base asset; converted with market size decimals.
    size: z.string().min(1).max(40),
    leverage: z.number().int().min(1).max(50),
    slippageBps: z.number().int().min(1).max(500),
    sourcePostId: z.string().regex(/^[0-9]{1,30}$/),
    confirm: z.literal(true).optional(),
  })
  .strict();

function config() {
  const maxLeverage = Number(process.env.PERPL_MAX_LEVERAGE || "5");
  return {
    apiUrl: process.env.PERPL_API_URL || "https://testnet.perpl.xyz/api",
    apiKey: process.env.PERPL_API_KEY ?? "",
    secret: process.env.PERPL_API_KEY_SECRET ?? "",
    accountId: process.env.PERPL_ACCOUNT_ID ?? "",
    maxLeverage:
      Number.isInteger(maxLeverage) && maxLeverage >= 1 && maxLeverage <= 50
        ? maxLeverage
        : 5,
    maxSize: process.env.PERPL_MAX_SIZE || "1",
  };
}

export function perplMode() {
  const c = config();
  return c.apiKey && c.secret && /^[0-9]+$/.test(c.accountId)
    ? ("live" as const)
    : ("demo" as const);
}

async function reviewed(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
) {
  const { user, service, chainId } = await identityContext(request);
  if (chainId !== 10143) throw new IdentityError("trading_testnet_only", 409);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    user.xAccount?.xUserId !== binding.xUserId ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("current_binding_required", 403);
  const snapshot = await perplSnapshot().catch(() => {
    throw new IdentityError("perpl_unavailable", 503);
  });
  const market = snapshot.markets.find((m) => m.marketId === input.marketId);
  if (!market) throw new IdentityError("market_unavailable", 409);
  if (!market.open) throw new IdentityError("market_closed", 409);
  const c = config();
  if (input.leverage > c.maxLeverage)
    throw new IdentityError("leverage_above_cap", 409);
  let size: bigint, maxSize: bigint;
  try {
    size = stakeUnits(input.size, market.sizeDecimals);
    maxSize = stakeUnits(c.maxSize, market.sizeDecimals);
  } catch {
    throw new IdentityError("invalid_amount");
  }
  if (size > maxSize) throw new IdentityError("size_above_cap", 409);
  return { binding, market, size, maxSize, c, privyUserId: user.privyUserId };
}

export async function preparePerp(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
) {
  const { binding, market, size, c } = await reviewed(request, input);
  return {
    status: "prepared" as const,
    venue: "Perpl" as const,
    instrument: "perp" as const,
    mode: perplMode(),
    chainId: 10143 as const,
    wallet: binding.wallet,
    market: market.symbol,
    marketId: market.marketId,
    exchange: market.exchange,
    collateral: market.collateral.symbol,
    side: input.side,
    size: input.size,
    sizeUnits: size.toString(),
    leverage: input.leverage,
    maxLeverage: c.maxLeverage,
    slippageBps: input.slippageBps,
    orderType: "Immediate-or-cancel market order",
    sourcePostId: input.sourcePostId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    observedAt: new Date().toISOString(),
  };
}

export async function submitPerp(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
) {
  if (input.confirm !== true) throw new IdentityError("confirmation_required");
  const { market, size, maxSize, c, privyUserId } = await reviewed(
    request,
    input,
  );
  // One submission per user, post and side per minute; protects against double clicks and replays.
  if (
    !allow(`perp:${privyUserId}:${input.sourcePostId}:${input.side}`, 1, 60_000)
  )
    throw new IdentityError("duplicate_order", 409);
  const requestId = Date.now();
  const order = buildPerplOpenOrder({
    marketId: market.marketId,
    accountId: perplMode() === "live" ? c.accountId : "0",
    side: input.side,
    size: size.toString(),
    leverageHundredths: input.leverage * 100,
    maxLeverageHundredths: c.maxLeverage * 100,
    maxSize: maxSize.toString(),
    slippageBps: input.slippageBps,
    requestId,
  });
  if (perplMode() === "demo")
    return {
      status: "demo" as const,
      mode: "demo" as const,
      requestId,
      market: market.symbol,
      order,
      message:
        "Demo mode: PERPL_API_KEY, PERPL_API_KEY_SECRET and PERPL_ACCOUNT_ID are not configured. The order was validated but not sent; no position exists.",
    };
  const target = "/v1/trading/orders";
  const body = JSON.stringify({ d: [order] });
  const { headers } = signPerplRequest({
    chainId: 10143,
    method: "POST",
    target,
    body,
    apiKey: c.apiKey,
    secretHex: c.secret,
  });
  const response = await fetch(`${c.apiUrl}${target}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => {
    throw new IdentityError("perpl_unavailable", 503);
  });
  const result = z
    .object({
      status: z
        .object({ code: z.number(), error: z.string().optional() })
        .optional(),
      statuses: z
        .array(z.object({ code: z.number(), error: z.string().optional() }))
        .optional(),
    })
    .safeParse(await response.json().catch(() => null));
  const status = result.success
    ? (result.data.statuses?.[0] ?? result.data.status)
    : undefined;
  const accepted = response.ok && status?.code === 0;
  return {
    status: accepted ? ("submitted" as const) : ("rejected" as const),
    mode: "live" as const,
    requestId,
    market: market.symbol,
    order,
    message: accepted
      ? "Accepted by Perpl for forwarding. Submitted is not filled; check positions for the outcome."
      : `Perpl rejected the order${status?.error ? `: ${status.error.slice(0, 200)}` : ` (HTTP ${response.status})`}.`,
  };
}
