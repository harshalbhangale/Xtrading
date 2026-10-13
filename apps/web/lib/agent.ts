import "server-only";
import { tradeIntents } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  type KuruMarketKey,
  kuruMainnet,
  kuruMainnetUsdc,
  mainnetFillsFromLogs,
  mainnetTopOfBookEstimate,
} from "@call-my-bluff/integrations/kuru";
import { and, asc, eq } from "drizzle-orm";
import { formatUnits, type Hex } from "viem";
import { getDatabase } from "./database";
import { detectedPosts } from "./detected-posts";
import { boundWallet } from "./fill-indexing";
import { kuruMainnetSnapshot, mainnetClient } from "./markets";

/**
 * Calls detected in a creator's posts, newest first. Only posts seen by Xtrading
 * extension users or classified through the API exist here; this is not a full X feed.
 */
export async function recentCalls(handle: string, since: string | null) {
  const posts = await detectedPosts(handle);
  if (!posts) throw new IdentityError("creator_unavailable");
  const after = since ? Date.parse(since) : Number.NEGATIVE_INFINITY;
  return {
    handle,
    coverage:
      "Posts seen by Xtrading extension users or classified through the API. Not a complete X timeline.",
    calls: posts
      .filter(
        (post) =>
          post.signal.isCall && Date.parse(post.signal.classifiedAt) > after,
      )
      .map((post) => ({
        postId: post.signal.postId,
        url: `https://x.com/${post.signal.handle}/status/${post.signal.postId}`,
        asset: post.signal.asset,
        direction: post.signal.direction,
        instrument: post.signal.instrument,
        summary: post.signal.summary,
        confidence: post.signal.confidence,
        classifiedAt: post.signal.classifiedAt,
        route: post.route,
      })),
  };
}

/**
 * The signed-in wallet's open Kuru mainnet position in one market, rebuilt from
 * its recorded trades' receipts (amounts actually filled), valued with a sell
 * quote at the current top of book. Unrecorded trades are not included.
 */
export async function mainnetPosition(request: Request, key: KuruMarketKey) {
  const { wallet, privyUserId } = await boundWallet(request);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const market = kuruMainnet.markets[key];
  const rows = await database.db
    .select({ hash: tradeIntents.transactionHash })
    .from(tradeIntents)
    .where(
      and(
        eq(tradeIntents.privyUserId, privyUserId),
        eq(tradeIntents.chainId, 143),
        eq(tradeIntents.market, market.market.toLowerCase()),
      ),
    )
    .orderBy(asc(tradeIntents.createdAt))
    .limit(50);
  const client = mainnetClient();
  let bought = 0n,
    spent = 0n,
    sold = 0n;
  const trades: {
    transactionHash: string;
    side: string;
    base: string;
    usdc: string;
  }[] = [];
  for (const row of rows) {
    if (!row.hash) continue;
    const receipt = await client
      .getTransactionReceipt({ hash: row.hash as Hex })
      .catch(() => null);
    if (receipt?.status !== "success") continue;
    const fill = mainnetFillsFromLogs({ key, wallet, logs: receipt.logs });
    if (!fill) continue;
    if (fill.side === "buy") {
      bought += fill.baseAmount;
      spent += fill.quoteAmount;
    } else {
      sold += fill.baseAmount;
    }
    trades.push({
      transactionHash: row.hash,
      side: fill.side,
      base: formatUnits(fill.baseAmount, market.base.decimals),
      usdc: formatUnits(fill.quoteAmount, kuruMainnetUsdc.decimals),
    });
  }
  const open = bought > sold ? bought - sold : 0n;
  if (open === 0n || bought === 0n)
    return { market: `${key}/USDC`, chainId: 143, open: "0", trades };
  const costOfOpen = (spent * open) / bought;
  const snapshot = await kuruMainnetSnapshot(key);
  const value = mainnetTopOfBookEstimate({
    key,
    side: "sell",
    spend: open,
    bid: snapshot.bid,
    ask: snapshot.ask,
    takerFeeBps: snapshot.takerFeeBps,
  });
  const pnlBps =
    costOfOpen > 0n ? ((value - costOfOpen) * 10_000n) / costOfOpen : null;
  return {
    market: `${key}/USDC`,
    chainId: 143,
    open: formatUnits(open, market.base.decimals),
    openSymbol: market.base.symbol,
    costBasisUsdc: formatUnits(costOfOpen, kuruMainnetUsdc.decimals),
    sellValueUsdc: formatUnits(value, kuruMainnetUsdc.decimals),
    pnlPercent: pnlBps === null ? null : (Number(pnlBps) / 100).toFixed(2),
    blockNumber: snapshot.block.number.toString(),
    trades,
    note: "Entry and size come from the recorded trades' receipts. The sell value is a top-of-book indication after the taker fee, not a commitment; prepare_trade simulates the real sell.",
  };
}
