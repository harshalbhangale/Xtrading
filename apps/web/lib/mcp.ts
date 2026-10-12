import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import { normalizeHandle } from "@call-my-bluff/domain";
import { bookEstimate, tradeTokens } from "@call-my-bluff/integrations/kuru";
import { stakeUnits } from "@call-my-bluff/integrations/stake";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatUnits } from "viem";
import { z } from "zod";
import { publicCallLedger } from "./calls";
import { myActivity } from "./fill-indexing";
import { kuruMarketSnapshot, perplSnapshot } from "./markets";
import { publicCreatorEvidence } from "./public-creator";
import { classifyPost } from "./signals";
import { kuruAccount, prepareSpot } from "./spot-trade";

const handle = z
  .string()
  .regex(/^@?[A-Za-z0-9_]{1,15}$/)
  .describe("X handle, with or without @");
const market = z
  .enum(["MON", "WETH", "WBTC"])
  .describe("Kuru Spot V2 testnet market against USDC");
const side = z.enum(["buy", "sell"]);
const amount = z
  .string()
  .regex(/^(0|[1-9][0-9]*)(\.[0-9]+)?$/)
  .max(40)
  .describe(
    "Decimal amount of the input token: USDC when buying, the base token when selling",
  );

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
        "Xtrading evidence and trade preparation on Monad testnet (chain 10143). Identity, refundable stake, call outcomes and wallet returns are separate signals; never merge them into one judgement. Test tokens have no monetary value. prepare_trade returns an unsigned transaction for the user to approve in their own wallet; nothing here signs or submits.",
    },
  );

  server.registerTool(
    "get_creator",
    {
      title: "Creator evidence",
      description:
        "Identity binding (stable X ID to wallet) and refundable stake status for an X handle, with indexer freshness. A binding is not an endorsement and stake is not accuracy.",
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
    "get_stake_status",
    {
      title: "Stake status",
      description:
        "Refundable stake for a handle's bound wallet: balance, withdrawal state and whether Envio and the chain agree.",
      inputSchema: { handle },
      annotations: { readOnlyHint: true },
    },
    ({ handle: value }) =>
      run(async () => {
        const evidence = await publicCreatorEvidence(value.replace(/^@/, ""));
        if (!evidence) throw new IdentityError("invalid_handle");
        const stake = evidence.stake;
        return {
          handle: evidence.handle,
          status: stake.status,
          balance:
            stake.balance && stake.symbol
              ? `${formatUnits(BigInt(stake.balance), 6)} ${stake.symbol}`
              : null,
          withdrawableAt: stake.withdrawableAt ?? null,
          indexer: stake.indexing?.status ?? "unavailable",
          observedAt: evidence.observedAt,
          note: "Demo tokens on Monad testnet; no monetary value.",
        };
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
        "Kuru Spot V2 testnet markets (MON/USDC, WETH/USDC, WBTC/USDC) with top of book, and open Perpl perpetual markets.",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(async () => {
        const [perpl, ...books] = await Promise.allSettled([
          perplSnapshot(),
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
        };
      }),
  );

  server.registerTool(
    "quote_trade",
    {
      title: "Indicative spot quote",
      description:
        "Indicative output for a Kuru spot trade from resting order-book levels, after the taker fee. Display only: prepare_trade simulates the real swap and sets the enforced minimum.",
      inputSchema: { market, side, amount },
      annotations: { readOnlyHint: true },
    },
    ({ market: key, side: direction, amount: value }) =>
      run(async () => {
        const tokens = tradeTokens(key, direction);
        let amountIn: bigint;
        try {
          amountIn = stakeUnits(value, tokens.input.decimals);
        } catch {
          throw new IdentityError("invalid_amount");
        }
        const { book, takerFeePps, block } = await kuruMarketSnapshot(key);
        const estimate = bookEstimate({
          key,
          side: direction,
          amountIn,
          book,
          takerFeePps,
        });
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
    (input) => run(() => classifyPost({ ...input, images: [] })),
  );

  server.registerTool(
    "get_portfolio",
    {
      title: "Your Kuru balances and fills",
      description:
        "Signed-in users only: wallet and Kuru-account balances plus confirmed swaps, deposits and withdrawals indexed by Envio.",
      annotations: { readOnlyHint: true },
    },
    () =>
      run(async () => {
        const [balances, activity] = await Promise.all([
          kuruAccount(request, 10143),
          myActivity(request),
        ]);
        return { balances, activity };
      }),
  );

  server.registerTool(
    "prepare_trade",
    {
      title: "Prepare a Kuru spot trade",
      description:
        "Signed-in users only. Returns the single next unsigned transaction (exact approval, deposit, or a simulated swap with an enforced minimum output and onchain deadline). The user must approve it in their own wallet; this tool never signs or submits. Reviews expire after 30 seconds.",
      inputSchema: {
        market,
        side,
        amount,
        slippageBps: z.number().int().min(1).max(500).default(100),
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
      slippageBps,
      sourcePostId,
    }) =>
      run(async () => {
        const tokens = tradeTokens(key, direction);
        let units: bigint;
        try {
          units = stakeUnits(value, tokens.input.decimals);
        } catch {
          throw new IdentityError("invalid_amount");
        }
        const review = await prepareSpot(request, {
          instrument: "spot",
          chainId: 10143,
          market: key,
          side: direction,
          amount: units.toString(),
          slippageBps,
          sourcePostId: sourcePostId ?? null,
        });
        return {
          ...review,
          approveIn: "the user's own wallet",
          tradeUrl: `${new URL(request.url).origin}/dashboard/trade?market=${key}&side=${direction}`,
        };
      }),
  );

  return server;
}

export const mcpTools = [
  "get_creator",
  "get_stake_status",
  "list_calls",
  "get_markets",
  "quote_trade",
  "classify_post",
  "get_portfolio",
  "prepare_trade",
] as const;
