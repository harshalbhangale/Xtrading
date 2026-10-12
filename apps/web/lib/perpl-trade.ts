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
    // User-supplied attribution; optional, never verified against the post.
    sourcePostId: z
      .string()
      .regex(/^[0-9]{1,30}$/)
      .nullable(),
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
    // Live orders execute on one team-held Perpl account signed by the server key,
    // so only these stable X user IDs may send them; everyone else stays in demo.
    operators: (process.env.PERPL_OPERATOR_X_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[0-9]+$/.test(id)),
  };
}

export function perplMode(xUserId?: string) {
  const c = config();
  return c.apiKey &&
    c.secret &&
    /^[0-9]+$/.test(c.accountId) &&
    xUserId !== undefined &&
    c.operators.includes(xUserId)
    ? ("live" as const)
    : ("demo" as const);
}
const executionNote = (mode: "live" | "demo", accountId: string) =>
  mode === "live"
    ? `Executes on the team's Perpl testnet account #${accountId} via its API key, not from your wallet.`
    : "Demo: the order is validated against live market caps but not sent. No position is opened.";

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
  return {
    binding,
    market,
    size,
    maxSize,
    c,
    privyUserId: user.privyUserId,
    mode: perplMode(binding.xUserId),
  };
}

export async function preparePerp(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
) {
  const { binding, market, size, c, mode } = await reviewed(request, input);
  return {
    status: "prepared" as const,
    venue: "Perpl" as const,
    instrument: "perp" as const,
    mode,
    execution: executionNote(mode, c.accountId),
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
  const { market, size, maxSize, c, privyUserId, mode } = await reviewed(
    request,
    input,
  );
  // One submission per user, post and side per minute; protects against double clicks and replays.
  if (
    !allow(
      `perp:${privyUserId}:${input.marketId}:${input.sourcePostId ?? "none"}:${input.side}`,
      1,
      60_000,
    )
  )
    throw new IdentityError("duplicate_order", 409);
  const requestId = Date.now();
  const order = buildPerplOpenOrder({
    marketId: market.marketId,
    accountId: mode === "live" ? c.accountId : "0",
    side: input.side,
    size: size.toString(),
    leverageHundredths: input.leverage * 100,
    maxLeverageHundredths: c.maxLeverage * 100,
    maxSize: maxSize.toString(),
    slippageBps: input.slippageBps,
    requestId,
  });
  if (mode === "demo")
    return {
      status: "demo" as const,
      mode: "demo" as const,
      requestId,
      market: market.symbol,
      order,
      message: executionNote(mode, c.accountId),
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

const orderStatuses = [
  "unspecified",
  "pending",
  "open",
  "partially-filled",
  "filled",
  "canceled",
  "expired",
  "failed",
  "untriggered",
  "triggered",
  "executed",
] as const;
const stamp = z
  .object({
    b: z.number().optional(),
    t: z.number().optional(),
    txid: z.string().optional(),
  })
  .partial();
const historySchema = z.object({
  d: z.array(
    z
      .object({
        at: stamp.optional(),
        rq: z.number(),
        mkt: z.number(),
        oid: z.number(),
        st: z.number(),
        os: z.number(),
        fp: z.number(),
        fs: z.number(),
        f: z.union([z.string(), z.number()]),
        lv: z.number(),
      })
      .passthrough(),
  ),
});
const positionsSchema = z.object({
  d: z.array(
    z
      .object({
        at: stamp.optional(),
        mkt: z.number(),
        rq: z.number(),
        st: z.number(),
        sd: z.number(),
        c: z.union([z.string(), z.number()]),
        ep: z.number(),
        s: z.number(),
        lv: z.number(),
      })
      .passthrough(),
  ),
});

async function signedGet(c: ReturnType<typeof config>, target: string) {
  const { headers } = signPerplRequest({
    chainId: 10143,
    method: "GET",
    target,
    body: "",
    apiKey: c.apiKey,
    secretHex: c.secret,
  });
  const response = await fetch(`${c.apiUrl}${target}`, {
    headers,
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new IdentityError("perpl_unavailable", 503);
  });
  if (!response.ok) throw new IdentityError("perpl_unavailable", 503);
  return response.json() as Promise<unknown>;
}

/**
 * Outcome of a live order, read back from Perpl: forwarding is not execution,
 * so the order's status, fill and resulting position come from Perpl's history.
 */
export async function perpStatus(request: Request, requestId: number) {
  const { user, service } = await identityContext(request);
  const binding = await service.current(user.privyUserId);
  if (!binding || perplMode(binding.xUserId) !== "live")
    throw new IdentityError("perpl_operator_only", 403);
  if (!Number.isSafeInteger(requestId) || requestId <= 0)
    throw new IdentityError("invalid_request_id");
  const c = config();
  const [history, positions] = await Promise.all([
    signedGet(c, "/v1/trading/order-history?count=50"),
    signedGet(c, "/v1/trading/positions"),
  ]);
  const order = historySchema
    .parse(history)
    .d.filter((o) => o.rq === requestId)
    .sort((a, b) => (b.at?.b ?? 0) - (a.at?.b ?? 0))[0];
  const position = positionsSchema
    .parse(positions)
    .d.find((p) => p.rq === requestId);
  return {
    requestId,
    order: order
      ? {
          marketId: order.mkt,
          status: orderStatuses[order.st] ?? "unspecified",
          originalSize: String(order.os),
          filledSize: String(order.fs),
          fillPrice: String(order.fp),
          fee: String(order.f),
          leverage: order.lv,
          block: order.at?.b ?? null,
          transactionHash: order.at?.txid ?? null,
        }
      : null,
    position: position
      ? {
          marketId: position.mkt,
          side: position.sd === 1 ? "long" : "short",
          size: String(position.s),
          entryPrice: String(position.ep),
          collateral: String(position.c),
          leverage: position.lv,
          transactionHash: position.at?.txid ?? null,
        }
      : null,
    observedAt: new Date().toISOString(),
  };
}
