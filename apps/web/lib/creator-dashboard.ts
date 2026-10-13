import "server-only";
import { tradeIntents } from "@call-my-bluff/database";
import { kuruMainnet } from "@call-my-bluff/integrations/kuru";
import { inArray } from "drizzle-orm";
import { zeroAddress } from "viem";
import { creatorEarnings } from "./creator-earnings";
import { payoutRegistration } from "./creator-payouts";
import { getDatabase } from "./database";
import { detectedPosts } from "./detected-posts";
import { kolRecord } from "./kol-record";

const tokens = new Map(
  [
    { address: zeroAddress, symbol: "MON", decimals: 18 },
    kuruMainnet.quote,
    kuruMainnet.markets.WETH.base,
    kuruMainnet.markets.WBTC.base,
  ].map((t) => [t.address.toLowerCase(), t]),
);

type Earned = { symbol: string; decimals: number; amount: string };
function addEarned(into: Map<string, bigint>, token: string, amount: bigint) {
  into.set(token, (into.get(token) ?? 0n) + amount);
}
function earnedList(byToken: Map<string, bigint>): Earned[] {
  // Per token only: unlike tokens are never summed into one number.
  return [...byToken].map(([address, amount]) => {
    const token = tokens.get(address);
    return {
      symbol: token?.symbol ?? `${address.slice(0, 6)}…`,
      decimals: token?.decimals ?? 18,
      amount: amount.toString(),
    };
  });
}

/**
 * The signed-in creator's earnings and per-post analytics. Earnings are
 * confirmed Kuru Flow payments indexed by Envio; they arrive in the payout
 * wallet inside each buyer's transaction, so there is nothing to withdraw.
 * Buys per post come from receipt-verified attributions (post ID chosen by
 * the buyer's link, not proven by the post).
 */
export async function creatorDashboard(request: Request) {
  const payout = await payoutRegistration(request);
  const [record, detected, earnings] = await Promise.all([
    kolRecord(payout.handle).catch(() => null),
    detectedPosts(payout.handle).catch(() => null),
    payout.enabled
      ? creatorEarnings(payout.wallet)
      : Promise.resolve({
          status: "unavailable" as const,
          payments: [],
          observedAt: new Date().toISOString(),
        }),
  ]);
  const calls = record?.ledger?.calls ?? [];
  const posts = new Map<
    string,
    {
      postId: string;
      url: string;
      at: string;
      text: string;
      call: {
        asset: string;
        direction: string;
        horizon: string;
        result: "open" | "success" | "failure" | "tie";
        returnBps: string | null;
      } | null;
      detected: { asset: string | null; direction: string | null } | null;
    }
  >();
  for (const call of calls)
    posts.set(call.postId, {
      postId: call.postId,
      url: call.sourceUrl,
      at: call.publishedAt,
      text: call.evidence.post.text,
      call: {
        asset: call.evidence.terms.assetId,
        direction: call.evidence.terms.direction,
        horizon: call.evidence.horizon,
        result: call.evidence.outcome ?? "open",
        returnBps: call.evidence.returnBps,
      },
      detected: null,
    });
  for (const post of detected ?? []) {
    const existing = posts.get(post.signal.postId);
    const detectedCall = {
      asset: post.signal.asset,
      direction: post.signal.direction,
    };
    if (existing) existing.detected = detectedCall;
    else
      posts.set(post.signal.postId, {
        postId: post.signal.postId,
        url: `https://x.com/${payout.handle}/status/${post.signal.postId}`,
        at: post.signal.classifiedAt,
        text: post.signal.summary,
        call: null,
        detected: detectedCall,
      });
  }

  const database = getDatabase();
  const postIds = [...posts.keys()];
  const trades =
    database && postIds.length
      ? await database.db
          .select({
            post: tradeIntents.sourcePostId,
            chainId: tradeIntents.chainId,
            side: tradeIntents.side,
            hash: tradeIntents.transactionHash,
          })
          .from(tradeIntents)
          .where(inArray(tradeIntents.sourcePostId, postIds))
          .catch(() => null)
      : [];
  const paymentByTx = new Map(
    earnings.payments.map((p) => [p.transactionHash.toLowerCase(), p]),
  );
  const totals = new Map<string, bigint>();
  for (const p of earnings.payments)
    addEarned(totals, p.token.toLowerCase(), BigInt(p.amount));

  const rows = [...posts.values()]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((post) => {
      const mine = (trades ?? []).filter((t) => t.post === post.postId);
      const earned = new Map<string, bigint>();
      for (const t of mine) {
        const paid = t.hash ? paymentByTx.get(t.hash.toLowerCase()) : null;
        if (paid)
          addEarned(earned, paid.token.toLowerCase(), BigInt(paid.amount));
      }
      return {
        ...post,
        buys: {
          testnet: mine.filter((t) => t.chainId === 10143 && t.side === "buy")
            .length,
          mainnet: mine.filter((t) => t.chainId === 143 && t.side === "buy")
            .length,
          sells: mine.filter((t) => t.side === "sell").length,
        },
        earned: earnedList(earned),
      };
    });

  return {
    handle: payout.handle,
    payoutWallet: payout.wallet,
    payoutEnabled: payout.enabled,
    feesEnabled: payout.mainnetFeesEnabled,
    feeBps: payout.bps,
    tier: record?.assessment.tier ?? null,
    assessment: record?.assessment ?? null,
    earnings: {
      status: earnings.status,
      paidBuys: earnings.payments.length,
      totals: earnedList(totals),
      recent: earnings.payments.slice(0, 10).map((p) => ({
        transactionHash: p.transactionHash,
        timestamp: p.timestamp,
        ...(earnedList(
          new Map([[p.token.toLowerCase(), BigInt(p.amount)]]),
        )[0] as Earned),
      })),
    },
    tradesStatus: trades ? "ready" : "unavailable",
    posts: rows,
    observedAt: new Date().toISOString(),
  };
}
export type CreatorDashboard = Awaited<ReturnType<typeof creatorDashboard>>;
