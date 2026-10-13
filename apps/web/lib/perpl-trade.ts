import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  buildPerplOpenOrder,
  signPerplRequest,
} from "@call-my-bluff/integrations/perpl";
import {
  perplWalletSchema,
  projectPerplAccount,
} from "@call-my-bluff/integrations/perpl-account";
import {
  buildPerplCloseOrder,
  signCloseReview,
  verifyCloseReview,
} from "@call-my-bluff/integrations/perpl-close";
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

// Perpl's API returns hashes without the 0x prefix; explorers reject those.
function txHash(value: string | null | undefined) {
  if (!value) return null;
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  return /^[0-9a-fA-F]{64}$/.test(hex) ? `0x${hex}` : null;
}

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

/** Public order caps; the same limits are enforced again on prepare and submit. */
export function perpLimits() {
  const c = config();
  return { maxLeverage: c.maxLeverage, maxSize: c.maxSize };
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

type Context = typeof identityContext;

async function reviewed(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
  context: Context,
) {
  const { user, service, chainId } = await context(request);
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
  if (market.marketMaxLeverage && input.leverage > market.marketMaxLeverage)
    throw new IdentityError("leverage_above_market_max", 409);
  if (market.maxSlippageBps && input.slippageBps > market.maxSlippageBps)
    throw new IdentityError("slippage_above_market_max", 409);
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

async function operatorAccount(c: ReturnType<typeof config>) {
  const value = perplWalletSchema.parse(
    await signedGet(c, "/v1/trading/wallet"),
  );
  const account = value.as.find((a) => String(a.id) === c.accountId);
  if (!account) throw new IdentityError("perpl_account_not_owned", 409);
  if (account.fr) throw new IdentityError("perpl_account_frozen", 409);
  if (!account.fw) throw new IdentityError("perpl_forwarding_disabled", 409);
  if (BigInt(account.b) <= 0n)
    throw new IdentityError("perpl_collateral_empty", 409);
  return account;
}

export async function preparePerp(
  request: Request,
  input: z.infer<typeof perpRequestSchema>,
  context: Context = identityContext,
) {
  const { binding, market, size, c, mode } = await reviewed(
    request,
    input,
    context,
  );
  const account = mode === "live" ? await operatorAccount(c) : null;
  return {
    accountId: account?.id ?? null,
    availableCollateral: account?.b ?? null,
    collateralDecimals: market.collateral.decimals,
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
  context: Context = identityContext,
) {
  if (input.confirm !== true) throw new IdentityError("confirmation_required");
  const { market, size, maxSize, c, privyUserId, mode } = await reviewed(
    request,
    input,
    context,
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
  const account = mode === "live" ? await operatorAccount(c) : null;
  const requestId = Math.max(Date.now(), (account?.lfr ?? 0) + 1);
  if (!Number.isSafeInteger(requestId))
    throw new IdentityError("invalid_request_id");
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
export async function perpStatus(
  request: Request,
  requestId: number,
  context: Context = identityContext,
) {
  const { user, service } = await context(request);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some(
      (w) => w.toLowerCase() === binding.wallet.toLowerCase(),
    ) ||
    perplMode(binding.xUserId) !== "live"
  )
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
          transactionHash: txHash(order.at?.txid),
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
          transactionHash: txHash(position.at?.txid),
        }
      : null,
    observedAt: new Date().toISOString(),
  };
}

/** Operator-only, account-scoped exchange snapshot; independent of an order request ID. */
export async function perpAccount(
  request: Request,
  context: Context = identityContext,
) {
  const { user, service, chainId } = await context(request);
  if (chainId !== 10143) throw new IdentityError("trading_testnet_only", 409);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some(
      (w) => w.toLowerCase() === binding.wallet.toLowerCase(),
    ) ||
    perplMode(binding.xUserId) !== "live"
  )
    throw new IdentityError("perpl_operator_only", 403);
  const c = config();
  const [wallet, positions, history, snapshot] = await Promise.all([
    signedGet(c, "/v1/trading/wallet"),
    signedGet(c, "/v1/trading/positions"),
    signedGet(c, "/v1/trading/order-history?count=20"),
    perplSnapshot(),
  ]);
  const state = projectPerplAccount(c.accountId, wallet, positions, history);
  return {
    ...state,
    chainId: 10143,
    collateralSymbol: "AUSD",
    collateralDecimals: 6,
    source: "Perpl testnet API",
    observedAt: new Date().toISOString(),
    markets: snapshot.markets.map((m) => ({
      marketId: m.marketId,
      symbol: m.symbol,
      priceDecimals: m.priceDecimals,
      sizeDecimals: m.sizeDecimals,
    })),
  };
}

export const closeRequestSchema = z
  .object({
    positionId: z.string().regex(/^[0-9]{1,20}$/),
    slippageBps: z.number().int().min(1).max(500),
  })
  .strict();
export const closeSubmitSchema = z
  .object({
    reviewToken: z.string().min(1).max(4096),
    confirm: z.literal(true),
  })
  .strict();

export async function preparePerpClose(
  request: Request,
  input: z.infer<typeof closeRequestSchema>,
) {
  const state = await perpAccount(request);
  if (state.frozen || !state.forwarding)
    throw new IdentityError("perpl_account_unavailable", 409);
  const position = state.positions.find(
    (p) => p.positionId === input.positionId,
  );
  if (!position) throw new IdentityError("position_not_open", 409);
  const snapshot = await perplSnapshot();
  const market = snapshot.markets.find((m) => m.marketId === position.marketId);
  if (!market?.open) throw new IdentityError("market_closed", 409);
  if (market.maxSlippageBps && input.slippageBps > market.maxSlippageBps)
    throw new IdentityError("slippage_above_market_max", 409);
  const { user } = await identityContext(request);
  const c = config();
  const review = {
    accountId: state.accountId,
    positionId: position.positionId,
    marketId: position.marketId,
    side: position.side,
    size: position.size,
    leverageHundredths: position.leverageHundredths,
    slippageBps: input.slippageBps,
    requestId: Math.max(Date.now(), state.lastRequestId + 1),
    expiresAt: Date.now() + 60000,
    owner: user.privyUserId,
  };
  const mark = market.quote.mark;
  const notional =
    mark === null
      ? null
      : (BigInt(mark) * BigInt(position.size) * 1000000n) /
        10n ** BigInt(market.priceDecimals + market.sizeDecimals);
  const fee =
    notional === null || market.takerFeePpm === null
      ? null
      : (notional * BigInt(market.takerFeePpm) + 999999n) / 1000000n;
  return {
    reviewToken: signCloseReview(review, c.secret),
    accountId: state.accountId,
    market: market.symbol,
    positionId: position.positionId,
    side: position.side,
    size: position.size,
    sizeDecimals: market.sizeDecimals,
    collateral: position.collateral,
    estimatedFee: fee?.toString() ?? null,
    slippageBps: input.slippageBps,
    expiresAt: new Date(review.expiresAt).toISOString(),
    requestId: review.requestId,
    note: "Full close-only IOC order. May fill partially. Returned exchange collateral depends on realized PnL, fees and funding; this does not withdraw to a wallet.",
  };
}

export async function submitPerpClose(
  request: Request,
  input: z.infer<typeof closeSubmitSchema>,
) {
  const { user } = await identityContext(request);
  const c = config();
  let review: ReturnType<typeof verifyCloseReview>;
  try {
    review = verifyCloseReview(input.reviewToken, c.secret, user.privyUserId);
  } catch {
    throw new IdentityError("invalid_close_review", 409);
  }
  const state = await perpAccount(request);
  if (state.frozen || !state.forwarding || state.accountId !== review.accountId)
    throw new IdentityError("perpl_account_unavailable", 409);
  const position = state.positions.find(
    (p) => p.positionId === review.positionId,
  );
  if (
    !position ||
    position.size !== review.size ||
    position.side !== review.side ||
    position.marketId !== review.marketId ||
    position.leverageHundredths !== review.leverageHundredths
  )
    throw new IdentityError("position_changed_review_again", 409);
  if (state.lastRequestId >= review.requestId)
    throw new IdentityError("request_already_forwarded_check_status", 409);
  const snapshot = await perplSnapshot();
  const market = snapshot.markets.find((m) => m.marketId === review.marketId);
  if (
    !market?.open ||
    (market.maxSlippageBps && review.slippageBps > market.maxSlippageBps)
  )
    throw new IdentityError("market_unavailable", 409);
  if (!allow(`perp-close:${review.accountId}:${review.positionId}`, 1, 60000))
    throw new IdentityError("duplicate_order", 409);
  const order = buildPerplCloseOrder(review);
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
  try {
    const response = await fetch(`${c.apiUrl}${target}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const result = z
      .object({
        status: z.object({ code: z.number() }).optional(),
        statuses: z.array(z.object({ code: z.number() })).optional(),
      })
      .safeParse(await response.json().catch(() => null));
    const status = result.success
      ? (result.data.statuses?.[0] ?? result.data.status)
      : null;
    if (!status)
      return {
        status: "unknown",
        requestId: review.requestId,
        message:
          "Response uncertain. Check this request's status before retrying.",
      };
    return {
      status: response.ok && status.code === 0 ? "submitted" : "rejected",
      requestId: review.requestId,
      message:
        response.ok && status.code === 0
          ? "Accepted for forwarding. Check actual fill and remaining position; this is not a withdrawal."
          : "Close order rejected. Refresh the account before reviewing again.",
    };
  } catch {
    return {
      status: "unknown",
      requestId: review.requestId,
      message:
        "Submission uncertain. Check this request's status before retrying.",
    };
  }
}
