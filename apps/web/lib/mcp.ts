import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import { normalizeHandle } from "@call-my-bluff/domain";
import {
  bookEstimate,
  mainnetTopOfBookEstimate,
  networkTradeTokens,
} from "@call-my-bluff/integrations/kuru";
import { PERPL_MAINNET } from "@call-my-bluff/integrations/perpl-exchange";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatUnits } from "viem";
import { z } from "zod";
import { mainnetPosition, recentCalls } from "./agent";
import { publicCallLedger } from "./calls";
import { mainnetTrades, myActivity } from "./fill-indexing";
import {
  kuruMainnetSnapshot,
  kuruMarketSnapshot,
  perplMainnetEnabled,
  perplSnapshot,
} from "./markets";
import {
  perpAccount,
  preparePerp,
  preparePerpClose,
  preparePerpWithdraw,
} from "./perpl-trade";
import { publicCreatorEvidence } from "./public-creator";
import { classifyPost } from "./signals";
import { kuruAccount, prepareSpot } from "./spot-trade";

const handle = z
  .string()
  .regex(/^@?[A-Za-z0-9_]{1,15}$/)
  .describe("X handle, with or without @");
const market = z
  .enum(["MON", "WETH", "WBTC"])
  .describe("Kuru spot market against USDC (WBTC trades cbBTC on mainnet)");
const chainId = z
  .union([z.literal(10143), z.literal(143)])
  .default(10143)
  .describe(
    "10143 = Monad testnet (default). 143 = Monad mainnet with real funds; pass it explicitly.",
  );
const side = z.enum(["buy", "sell"]);
const amount = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/)
  .max(40)
  .describe(
    "Decimal amount of the input token: USDC when buying, the base token when selling",
  );

const perpMarketId = z
  .number()
  .int()
  .nonnegative()
  .describe(
    "Perpl marketId from get_markets for the same network (perpl or perplMainnet markets[].marketId); IDs differ between testnet and mainnet",
  );
const slippageBps = z.number().int().min(1).max(500).default(100);

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
const failure = (message: string) => ({
  content: [{ type: "text" as const, text: message }],
  isError: true,
});
function errorText(error: unknown) {
  if (error instanceof IdentityError)
    return error.code === "authentication_required" ||
      error.code === "invalid_session"
      ? "This tool needs the user's Xtrading session: send their Privy access token as an Authorization: Bearer header on the MCP connection."
      : `Request refused: ${error.code}.`;
  return "The service is temporarily unavailable.";
}
/** A link to the trade page that opens the same review for the user to sign. */
function approvalUrl(request: Request, entries: Record<string, string>) {
  const url = new URL("/dashboard/trade", new URL(request.url).origin);
  for (const [name, entry] of Object.entries(entries))
    if (entry) url.searchParams.set(name, entry);
  return url.href;
}
/** An empty book side is reported as unavailable, never as a zero-output quote. */
function noLiquidity(key: string, side: "buy" | "sell", sideEmpty: boolean) {
  return {
    market: `${key}/USDC`,
    side,
    status: "unavailable" as const,
    reason: sideEmpty
      ? `No ${side === "buy" ? "asks" : "bids"} resting on the ${key}/USDC book.`
      : "The amount is too small to fill at the resting price.",
  };
}
async function run(task: () => Promise<unknown>) {
  try {
    return json(await task());
  } catch (error) {
    return failure(errorText(error));
  }
}

/**
 * A fresh server per request (stateless transport). `request` carries the
 * caller's Authorization header to the authenticated tools; public tools ignore it.
 * No tool signs or submits a transaction.
 */
export function xtradingMcp(request: Request) {
  const server = new McpServer(
    { name: "xtrading", version: "0.1.0" },
    {
      instructions:
        "Xtrading evidence and trade preparation on Monad. Testnet (10143) is the default; mainnet (143) moves real funds and must be requested explicitly with chainId. Identity, call outcomes and wallet returns are separate signals; never merge them into one judgement. prepare_trade (Kuru spot) and prepare_perp, prepare_perp_close and prepare_perp_withdraw (Perpl perps; testnet unless chainId 143 is passed) return unsigned transactions and an approvalUrl for the user to approve in their own wallet; nothing here signs or submits. recent_calls only covers posts seen by Xtrading users, not a full X feed.",
    },
  );

  server.registerTool(
    "get_creator",
    {
      title: "Creator evidence",
      description:
        "Identity binding (stable X ID to wallet) for an X handle. A binding proves account ownership, not accuracy.",
      inputSchema: { handle },
      annotations: { readOnlyHint: true },
    },
    ({ handle: value }) =>
      run(async () => {
        const evidence = await publicCreatorEvidence(value.replace(/^@/, ""));
        if (!evidence) throw new IdentityError("invalid_handle");
        return evidence;
      }),
  );

  server.registerTool(
    "list_calls",
    {
      title: "Creator call ledger",
      description:
        "Calls the creator registered from their own posts, priced at posting and scored at expiry under directional-return-v1 (rules at /methodology). Outcomes are hypothetical, not wallet returns; unregistered posts are not covered.",
      inputSchema: { handle },
      annotations: { readOnlyHint: true },
    },
    ({ handle: value }) =>
      run(async () => {
        const normalized = normalizeHandle(value.replace(/^@/, ""));
        const ledger = normalized ? await publicCallLedger(normalized) : null;
        if (!ledger) throw new IdentityError("creator_unavailable");
        return ledger;
      }),
  );

  server.registerTool(
    "get_markets",
    {
      title: "Tradable markets",
      description:
        "Kuru Spot V2 testnet markets (MON/USDC, WETH/USDC, WBTC/USDC) with top of book, open Perpl testnet perp markets (perpl) and, when the server enables it, Perpl mainnet markets (perplMainnet, real AUSD).",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(async () => {
        const [perpl, perplMainnet, ...books] = await Promise.allSettled([
          perplSnapshot(),
          perplMainnetEnabled()
            ? perplSnapshot(PERPL_MAINNET)
            : Promise.reject(new Error("disabled")),
          kuruMarketSnapshot("MON"),
          kuruMarketSnapshot("WETH"),
          kuruMarketSnapshot("WBTC"),
        ]);
        return {
          kuru: books.map((r) =>
            r.status === "fulfilled"
              ? r.value.state
              : { status: "unavailable" },
          ),
          perpl:
            perpl.status === "fulfilled"
              ? perpl.value
              : { status: "unavailable" },
          perplMainnet:
            perplMainnet.status === "fulfilled"
              ? perplMainnet.value
              : {
                  status: perplMainnetEnabled() ? "unavailable" : "disabled",
                },
        };
      }),
  );

  server.registerTool(
    "quote_trade",
    {
      title: "Indicative spot quote",
      description:
        "Indicative output for a Kuru spot trade from resting order-book levels, after the taker fee. Display only: prepare_trade simulates the real swap and sets the enforced minimum.",
      inputSchema: { market, side, amount, chainId },
      annotations: { readOnlyHint: true },
    },
    ({ market: key, side: direction, amount: value, chainId: chain }) =>
      run(async () => {
        const tokens = networkTradeTokens(chain, key, direction);
        let amountIn: bigint;
        try {
          amountIn = stakeUnits(value, tokens.input.decimals);
        } catch {
          throw new IdentityError("invalid_amount");
        }
        if (chain === 143) {
          const s = await kuruMainnetSnapshot(key);
          const output = mainnetTopOfBookEstimate({
            key,
            side: direction,
            spend: amountIn,
            bid: s.bid,
            ask: s.ask,
            takerFeeBps: s.takerFeeBps,
          });
          if (output === 0n)
            return noLiquidity(
              key,
              direction,
              (direction === "buy" ? s.ask : s.bid) === 0n,
            );
          return {
            market: `${key}/USDC`,
            chainId: 143,
            side: direction,
            spend: `${value} ${tokens.input.symbol}`,
            indicativeOutput: `${formatUnits(output, tokens.output.decimals)} ${tokens.output.symbol}`,
            takerFeeBps: Number(s.takerFeeBps),
            blockNumber: s.block.number.toString(),
            note: "Mainnet top-of-book indication, not depth proof or a commitment. prepare_trade simulates the real swap and sets the minimum output.",
          };
        }
        const { book, takerFeePps, block, state } =
          await kuruMarketSnapshot(key);
        const estimate = bookEstimate({
          key,
          side: direction,
          amountIn,
          book,
          takerFeePps,
        });
        if (estimate.output === 0n)
          return noLiquidity(
            key,
            direction,
            (direction === "buy" ? state.bestAsk : state.bestBid) === null,
          );
        return {
          market: `${key}/USDC`,
          side: direction,
          spend: `${value} ${tokens.input.symbol}`,
          indicativeOutput: `${formatUnits(estimate.output, tokens.output.decimals)} ${tokens.output.symbol}`,
          bookCoversFullAmount: estimate.filled,
          takerFeeBps: Number(takerFeePps) / 1000,
          blockNumber: block.number.toString(),
          note: "Not a commitment. The minimum output is fixed when prepare_trade simulates the swap.",
        };
      }),
  );

  server.registerTool(
    "classify_post",
    {
      title: "Detect a trade call in a post",
      description:
        "Extracts asset, direction and instrument from an X post's text and maps it to a testnet market (Kuru spot or Perpl perp) when one exists. Bearish language never implies a leveraged short.",
      inputSchema: {
        postId: z.string().regex(/^[0-9]{1,30}$/),
        handle: z.string().regex(/^[A-Za-z0-9_]{1,15}$/),
        text: z.string().min(1).max(2000),
      },
    },
    (input) =>
      run(async () => {
        const result = await classifyPost({ ...input, images: [] });
        const { route } = result;
        const key = market.safeParse(
          route.status === "available" && route.venue === "Kuru"
            ? route.marketId
            : null,
        );
        if (
          route.status !== "available" ||
          !key.success ||
          (route.side !== "buy" && route.side !== "sell")
        )
          return result;
        // A spot route is offered only while its side of the book has liquidity.
        const empty = await kuruMarketSnapshot(key.data).then(
          ({ state }) =>
            (route.side === "buy" ? state.bestAsk : state.bestBid) === null,
          () => null,
        );
        if (empty === false) return result;
        return {
          ...result,
          route: {
            status: "unavailable" as const,
            reason:
              empty === null
                ? `The Kuru ${route.market} book could not be read; no route is offered.`
                : `No ${route.side === "buy" ? "asks" : "bids"} resting on the Kuru testnet ${route.market} book.`,
          },
        };
      }),
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Your Kuru balances and fills",
      description:
        "Signed-in users only: wallet balances plus confirmed trades. Testnet activity is indexed by Envio; mainnet trades are re-verified from their receipts.",
      inputSchema: { chainId },
      annotations: { readOnlyHint: true },
    },
    ({ chainId: chain }) =>
      run(async () => {
        const [balances, activity] = await Promise.all([
          kuruAccount(request, chain),
          chain === 143 ? mainnetTrades(request) : myActivity(request),
        ]);
        return { balances, activity };
      }),
  );

  server.registerTool(
    "prepare_trade",
    {
      title: "Prepare a Kuru spot trade",
      description:
        "Signed-in users only. Returns the single next unsigned transaction (exact approval, deposit, or a simulated swap with an enforced minimum output) and an approvalUrl that opens the same trade for the user to sign in their own wallet. This tool never signs or submits. Reviews expire after 30 seconds.",
      inputSchema: {
        market,
        side,
        amount,
        chainId,
        handle: handle
          .optional()
          .describe("Creator whose post prompted the trade"),
        slippageBps,
        sourcePostId: z
          .string()
          .regex(/^[0-9]{1,30}$/)
          .optional()
          .describe("X post that prompted the trade; recorded as unverified"),
      },
    },
    ({
      market: key,
      side: direction,
      amount: value,
      chainId: chain,
      handle: creator,
      slippageBps,
      sourcePostId,
    }) =>
      run(async () => {
        const tokens = networkTradeTokens(chain, key, direction);
        let units: bigint;
        try {
          units = stakeUnits(value, tokens.input.decimals);
        } catch {
          throw new IdentityError("invalid_amount");
        }
        const review = await prepareSpot(request, {
          instrument: "spot",
          chainId: chain,
          market: key,
          side: direction,
          amount: units.toString(),
          slippageBps,
          sourcePostId: sourcePostId ?? null,
        });
        return {
          ...review,
          approveIn: "the user's own wallet",
          approvalUrl: approvalUrl(request, {
            chainId: String(chain),
            market: key,
            side: direction,
            amount: value,
            slippage: String(slippageBps),
            postId: sourcePostId ?? "",
            handle: creator?.replace(/^@/, "") ?? "",
          }),
        };
      }),
  );

  server.registerTool(
    "recent_calls",
    {
      title: "A creator's recent calls",
      description:
        "Trade calls detected in a creator's recent posts, newest first, with the tradable route. Pass since (ISO time) to get only newer posts. Covers posts seen by Xtrading users, not a complete X feed.",
      inputSchema: {
        handle,
        since: z
          .string()
          .datetime()
          .optional()
          .describe("Only calls classified after this ISO time"),
      },
      annotations: { readOnlyHint: true },
    },
    ({ handle: value, since }) =>
      run(() => recentCalls(value.replace(/^@/, ""), since ?? null)),
  );

  server.registerTool(
    "get_position",
    {
      title: "Your mainnet position and profit",
      description:
        "Signed-in users only, Monad mainnet. Open size, cost basis and profit for one Kuru market, rebuilt from your recorded trades' receipts and valued with a current sell quote. Use it to decide a take-profit; then call prepare_trade to sell.",
      inputSchema: { market },
      annotations: { readOnlyHint: true },
    },
    ({ market: key }) => run(() => mainnetPosition(request, key)),
  );

  server.registerTool(
    "get_perp_account",
    {
      title: "Your Perpl account and positions",
      description:
        "Signed-in users only. Testnet by default; pass chainId 143 for mainnet. Your wallet's AUSD, your own Perpl exchange account (available and locked collateral) and open positions, read from the Exchange contract. Sizes and prices are integers; scale them with sizeDecimals, priceDecimals and collateralDecimals.",
      inputSchema: { chainId },
      annotations: { readOnlyHint: true },
    },
    ({ chainId: chain }) => run(() => perpAccount(request, chain)),
  );

  server.registerTool(
    "prepare_perp",
    {
      title: "Prepare a Perpl perp order",
      description:
        "Signed-in users only. Testnet by default; chainId 143 trades real AUSD on mainnet (only when the server enables it, with lower caps including a per-order collateral cap). Reviews an immediate-or-cancel order (limit at mark ± slippage) and returns the unsigned steps (exact AUSD approval and account funding when needed, then the order) plus an approvalUrl for the user to sign in their own wallet. Leverage and size are capped by the server. Positions can be liquidated. This tool never signs or submits. Reviews expire after 60 seconds.",
      inputSchema: {
        chainId,
        marketId: perpMarketId,
        side: z.enum(["long", "short"]),
        size: z
          .string()
          .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/)
          .max(40)
          .describe("Position size in the market's base asset, e.g. 0.01 BTC"),
        leverage: z.number().int().min(1).max(50),
        slippageBps,
        handle: handle
          .optional()
          .describe("Creator whose post prompted the trade"),
        sourcePostId: z
          .string()
          .regex(/^[0-9]{1,30}$/)
          .optional()
          .describe("X post that prompted the trade; recorded as unverified"),
      },
    },
    ({ handle: creator, sourcePostId, ...order }) =>
      run(async () => {
        const review = await preparePerp(request, {
          ...order,
          sourcePostId: sourcePostId ?? null,
        });
        return {
          ...review,
          approveIn: "the user's own wallet",
          approvalUrl: approvalUrl(request, {
            instrument: "perp",
            chainId: String(review.chainId),
            marketId: String(order.marketId),
            side: order.side,
            size: order.size,
            leverage: String(order.leverage),
            slippage: String(order.slippageBps),
            postId: sourcePostId ?? "",
            handle: creator?.replace(/^@/, "") ?? "",
          }),
        };
      }),
  );

  server.registerTool(
    "prepare_perp_close",
    {
      title: "Prepare closing a Perpl position",
      description:
        "Signed-in users only. Testnet by default; pass chainId 143 for mainnet. One unsigned reduce-only order that closes your whole position on one market; side and size are read from the chain. It may fill partially. Freed margin stays in your Perpl account until prepare_perp_withdraw. The approvalUrl opens your Perpl account panel to sign. Never signs or submits.",
      inputSchema: { chainId, marketId: perpMarketId, slippageBps },
    },
    (input) =>
      run(async () => ({
        ...(await preparePerpClose(request, input)),
        approveIn: "the user's own wallet",
        approvalUrl: approvalUrl(request, {
          instrument: "perp",
          chainId: String(input.chainId),
        }),
      })),
  );

  server.registerTool(
    "prepare_perp_withdraw",
    {
      title: "Prepare a Perpl withdrawal",
      description:
        "Signed-in users only. Testnet by default; pass chainId 143 for mainnet. One unsigned step that moves free AUSD from your Perpl account back to the same wallet, capped at the available balance. The approvalUrl opens your Perpl account panel to sign. Never signs or submits.",
      inputSchema: {
        chainId,
        amount: z
          .string()
          .regex(/^[0-9]{1,12}(\.[0-9]{1,6})?$/)
          .describe("AUSD amount, up to 6 decimals"),
      },
    },
    (input) =>
      run(async () => ({
        ...(await preparePerpWithdraw(request, input)),
        approveIn: "the user's own wallet",
        approvalUrl: approvalUrl(request, {
          instrument: "perp",
          chainId: String(input.chainId),
        }),
      })),
  );

  return server;
}

export const mcpTools = [
  "get_creator",
  "list_calls",
  "get_markets",
  "quote_trade",
  "classify_post",
  "get_portfolio",
  "prepare_trade",
  "recent_calls",
  "get_position",
  "get_perp_account",
  "prepare_perp",
  "prepare_perp_close",
  "prepare_perp_withdraw",
] as const;
