import "server-only";
import type {
  NansenCheck,
  NansenSource,
  NansenToken,
  PostSignal,
} from "@call-my-bluff/domain";
import {
  createNansenClient,
  type NansenPath,
} from "@call-my-bluff/integrations/nansen";
import {
  assessWalletTiming,
  dexTradesResponse,
  EVM_TOKEN_CHAINS,
  flowIntelligenceResponse,
  holdersResponse,
  MAJOR_TARGETS,
  type MajorTarget,
  PERP_MAJORS,
  type PositionEvent,
  perpEvents,
  perpTradesResponse,
  pnlLeaderboardResponse,
  pnlSummaryResponse,
  relatedWalletsResponse,
  SELLERS_WINDOW_MS,
  sellersAfterCall,
  spotEvents,
  tokenFlags,
  tokenInformationResponse,
  topHoldersPct,
  walletWindow,
  whoBoughtSoldResponse,
} from "@call-my-bluff/integrations/nansen-evidence";
import type { z } from "zod";

// Nansen covers mainnets only; `monad` here is Monad mainnet, never testnet.

// Credits per call from Nansen's pricing table; everything else costs 1.
const COST: Partial<Record<NansenPath, number>> = {
  "/api/v1/tgm/holders": 5,
  "/api/v1/tgm/pnl-leaderboard": 5,
};
// Hard ceiling so public traffic cannot drain the plan; overflow is reported as skipped.
const budget = { hour: 0, spent: 0 };
function take(cost: number) {
  const hour = Math.floor(Date.now() / 3_600_000);
  if (budget.hour !== hour) Object.assign(budget, { hour, spent: 0 });
  const limit = Number(process.env.NANSEN_CREDITS_PER_HOUR) || 150;
  if (budget.spent + cost > limit) return false;
  budget.spent += cost;
  return true;
}

// profiler/perp-trades has its own 5/minute limit; stay under it rather than collect 429s.
const perpCalls: number[] = [];
function perpSlot() {
  const now = Date.now();
  while (perpCalls.length && (perpCalls[0] as number) <= now - 60_000)
    perpCalls.shift();
  if (perpCalls.length >= 4) return false;
  perpCalls.push(now);
  return true;
}

type Session = {
  sources: NansenSource[];
  call<S extends z.ZodType>(
    path: NansenPath,
    chain: string | null,
    body: Record<string, unknown>,
    schema: S,
    isEmpty: (value: z.infer<S>) => boolean,
  ): Promise<z.infer<S> | null>;
};

function session(apiKey: string): Session {
  const client = createNansenClient(apiKey);
  const sources: NansenSource[] = [];
  return {
    sources,
    async call(path, chain, body, schema, isEmpty) {
      const endpoint = path.replace("/api/v1/", "");
      const record = (status: NansenSource["status"], note: string | null) =>
        sources.length < 24 && sources.push({ endpoint, chain, status, note });
      if (path === "/api/v1/profiler/perp-trades" && !perpSlot()) {
        record("skipped", "Nansen allows 5 perp-trade requests per minute");
        return null;
      }
      if (!take(COST[path] ?? 1)) {
        record("skipped", "Hourly Nansen credit budget reached");
        return null;
      }
      try {
        const result = await client.post(path, body);
        const parsed = schema.safeParse(result.data);
        if (!parsed.success) {
          record("failed", "Unexpected response shape; nothing claimed");
          return null;
        }
        record(isEmpty(parsed.data) ? "empty" : "ok", null);
        return parsed.data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed";
        // Nansen answers 403 when the plan has no credits left.
        record(
          "failed",
          message.includes("(403)")
            ? "Out of Nansen credits (403)"
            : message.slice(0, 160),
        );
        return null;
      }
    },
  };
}

type TokenInfo = z.infer<typeof tokenInformationResponse>;
type ResolvedToken = { chain: string; address: string; info: TokenInfo };
// Where a post's contract lives rarely changes; remember hits and misses for a day.
const tokenCache = new Map<
  string,
  { expires: number; value: ResolvedToken | null }
>();

async function resolveToken(
  s: Session,
  ref: PostSignal["tokenReferences"][number],
): Promise<ResolvedToken | null> {
  const key = `${ref.kind}:${ref.address}`;
  const hit = tokenCache.get(key);
  if (hit && hit.expires > Date.now()) {
    s.sources.push({
      endpoint: "tgm/token-information",
      chain: hit.value?.chain ?? null,
      status: hit.value ? "ok" : "empty",
      note: "Cached lookup",
    });
    return hit.value;
  }
  const chains = ref.kind === "solana" ? ["solana"] : [...EVM_TOKEN_CHAINS];
  let value: ResolvedToken | null = null;
  for (const chain of chains) {
    const info = await s.call(
      "/api/v1/tgm/token-information",
      chain,
      { chain, token_address: ref.address, timeframe: "1d" },
      tokenInformationResponse,
      (v) => !v.data?.symbol && !v.data?.name,
    );
    if (info?.data && (info.data.symbol || info.data.name)) {
      value = { chain, address: ref.address, info };
      break;
    }
  }
  if (tokenCache.size >= 500) tokenCache.clear();
  tokenCache.set(key, { expires: Date.now() + 86_400_000, value });
  return value;
}

const checkCache = new Map<string, { expires: number; value: NansenCheck }>();

export type NansenCheckInput = {
  wallet: string | null;
  asset: string | null;
  direction: "bullish" | "bearish" | null;
  instrument: PostSignal["instrument"];
  tokenReferences: PostSignal["tokenReferences"];
  callAt: number | null;
};

/**
 * Wallet and token evidence for one call. Every request made (or skipped) is
 * listed in `sources`; a missing or failed request is never shown as clean.
 */
export async function nansenCheck(
  input: NansenCheckInput,
): Promise<NansenCheck> {
  const now = Date.now();
  const observedAt = new Date(now).toISOString();
  const window = walletWindow(input.callAt, now);
  const callAt =
    input.callAt === null ? null : new Date(input.callAt).toISOString();
  const asset = input.asset?.toUpperCase() ?? null;
  const ref = input.tokenReferences[0] ?? null;
  const majors = asset && !ref ? (MAJOR_TARGETS[asset] ?? null) : null;
  const base = {
    wallet: input.wallet,
    window,
    callAt,
    observedAt,
    findings: [] as NansenCheck["findings"],
  };
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey)
    return {
      ...base,
      mode: "demo",
      verdict: "unavailable",
      wallet: null,
      chain: majors?.[0]?.chain ?? "monad",
      note: "Nansen is not configured for this deployment. No wallet or token observation is made.",
    };
  if (!asset && !ref)
    return {
      ...base,
      mode: "live",
      verdict: "not-applicable",
      chain: "monad",
      window: null,
      note: "The post names no asset or token address to check.",
    };

  const key = `${input.wallet?.toLowerCase()}:${asset}:${input.direction}:${input.instrument}:${ref?.address}:${input.callAt}`;
  const cached = checkCache.get(key);
  if (cached && cached.expires > now) return cached.value;

  const s = session(apiKey);
  const resolved = ref ? await resolveToken(s, ref) : null;
  // The bound wallet is EVM, so wallet checks run only on EVM chains.
  const evmToken = resolved && resolved.chain !== "solana" ? resolved : null;
  const targets: MajorTarget[] = evmToken
    ? [
        {
          chain: evmToken.chain,
          symbol: evmToken.info.data?.symbol ?? asset ?? "token",
          addresses: [evmToken.address],
        },
      ]
    : (majors ?? []);
  const chains = [...new Set(targets.map((t) => t.chain))];
  const primaryChain = resolved?.chain ?? chains[0] ?? "monad";
  const wallet = input.wallet;
  const direction = input.direction;
  const tokenLabel =
    resolved?.info.data?.symbol?.toUpperCase().slice(0, 12) ?? asset ?? "token";
  const perpSymbol =
    asset && (input.instrument === "perp" || PERP_MAJORS.has(asset))
      ? asset
      : null;

  const dexWindow = { from: window.from, to: window.to };
  const callMs = input.callAt;
  const sellersWindow = {
    from: new Date(callMs ?? now - 86_400_000).toISOString(),
    to: new Date(
      Math.min((callMs ?? now) + SELLERS_WINDOW_MS, now),
    ).toISOString(),
  };
  const pnlWindow = {
    from: new Date(now - 90 * 86_400_000).toISOString(),
    to: new Date(now).toISOString(),
  };
  const flowTarget = resolved
    ? { chain: resolved.chain, address: resolved.address }
    : majors?.[0]
      ? { chain: majors[0].chain, address: majors[0].addresses[0] as string }
      : null;
  const flowTimeframe =
    callMs !== null && now - callMs <= 2 * 86_400_000 ? "1d" : "7d";

  const [
    dexResults,
    perps,
    pnlSummary,
    related,
    tokenPnl,
    holders,
    sellers,
    flows,
  ] = await Promise.all([
    // 2. Wallet DEX trades around the post, on each chain the asset trades on.
    wallet && direction
      ? Promise.all(
          targets.map(async (target) => ({
            target,
            rows: await s.call(
              "/api/v1/profiler/dex-trades",
              target.chain,
              {
                address: wallet,
                chain: target.chain,
                date: dexWindow,
                pagination: { page: 1, per_page: 100 },
                order_by: [{ field: "block_timestamp", direction: "DESC" }],
              },
              dexTradesResponse,
              (v) => v.data.length === 0,
            ),
          })),
        )
      : Promise.resolve([]),
    // 4. Hyperliquid perps: long/short calls are usually traded there, not on a DEX.
    wallet && direction && perpSymbol
      ? s.call(
          "/api/v1/profiler/perp-trades",
          "hyperliquid",
          {
            address: wallet,
            date: dexWindow,
            filters: { token_symbol: perpSymbol },
            pagination: { page: 1, per_page: 100 },
            order_by: [{ field: "timestamp", direction: "DESC" }],
          },
          perpTradesResponse,
          (v) => v.data.length === 0,
        )
      : Promise.resolve(null),
    // 5. Actual wallet returns across chains: separate from call outcomes.
    wallet
      ? s.call(
          "/api/v1/profiler/address/pnl-summary",
          "all",
          { address: wallet, chain: "all", date: pnlWindow },
          pnlSummaryResponse,
          (v) => v.realized_pnl_usd == null,
        )
      : Promise.resolve(null),
    // 6. Possibly linked wallets (funding, deployment). Never treated as identity.
    wallet
      ? s.call(
          "/api/v1/profiler/address/related-wallets",
          primaryChain === "solana" ? "monad" : primaryChain,
          {
            address: wallet,
            chain: primaryChain === "solana" ? "monad" : primaryChain,
            pagination: { page: 1, per_page: 10 },
          },
          relatedWalletsResponse,
          (v) => v.data.length === 0,
        )
      : Promise.resolve(null),
    // 5. The creator's own profit on a token named by contract.
    wallet && evmToken
      ? s.call(
          "/api/v1/tgm/pnl-leaderboard",
          evmToken.chain,
          {
            chain: evmToken.chain,
            token_address: evmToken.address,
            date: {
              from: new Date((callMs ?? now) - 30 * 86_400_000).toISOString(),
              to: new Date(now).toISOString(),
            },
            filters: { trader_address: wallet },
            pagination: { page: 1, per_page: 5 },
          },
          pnlLeaderboardResponse,
          (v) => v.data.length === 0,
        )
      : Promise.resolve(null),
    // 1. Token risk: holder concentration for a contract named in the post.
    resolved
      ? s.call(
          "/api/v1/tgm/holders",
          resolved.chain,
          {
            chain: resolved.chain,
            token_address: resolved.address,
            label_type: "all_holders",
            pagination: { page: 1, per_page: 25 },
            order_by: [{ field: "token_amount", direction: "DESC" }],
          },
          holdersResponse,
          (v) => v.data.length === 0,
        )
      : Promise.resolve(null),
    // 1. Who sold right after the post.
    resolved
      ? s.call(
          "/api/v1/tgm/who-bought-sold",
          resolved.chain,
          {
            chain: resolved.chain,
            token_address: resolved.address,
            buy_or_sell: "SELL",
            date: sellersWindow,
            pagination: { page: 1, per_page: 10 },
            order_by: [{ field: "sold_volume_usd", direction: "DESC" }],
          },
          whoBoughtSoldResponse,
          (v) => v.data.length === 0,
        )
      : Promise.resolve(null),
    // 1. Smart money, whale, fresh-wallet and exchange flows.
    flowTarget
      ? s.call(
          "/api/v1/tgm/flow-intelligence",
          flowTarget.chain,
          {
            chain: flowTarget.chain,
            token_address: flowTarget.address,
            timeframe: flowTimeframe,
          },
          flowIntelligenceResponse,
          (v) => v.data.length === 0,
        )
      : Promise.resolve(null),
  ]);

  if (wallet && direction) {
    if (ref?.kind === "solana" || (resolved && !evmToken))
      s.sources.push({
        endpoint: "profiler/dex-trades",
        chain: "solana",
        status: "skipped",
        note: "The bound wallet is EVM; Solana wallet trades are not checked",
      });
    else if (!targets.length)
      s.sources.push({
        endpoint: "profiler/dex-trades",
        chain: null,
        status: "skipped",
        note: ref
          ? "Token contract not found on checked chains"
          : `No mainnet contract configured for ${asset}`,
      });
  }

  const linked = new Set(
    (related?.data ?? []).map((r) => r.address.toLowerCase()),
  );
  const flowRow = flows?.data[0] ?? null;
  const details = resolved?.info.data;
  const token: NansenToken | null = flowTarget
    ? {
        chain: flowTarget.chain,
        address: flowTarget.address,
        symbol: (details?.symbol?.slice(0, 24) || majors?.[0]?.symbol) ?? null,
        name: details?.name?.slice(0, 80) || null,
        origin: resolved ? "post" : "major",
        marketCapUsd: details?.token_details?.market_cap_usd ?? null,
        liquidityUsd: details?.spot_metrics?.liquidity_usd ?? null,
        holders:
          details?.spot_metrics?.total_holders != null
            ? Math.max(0, Math.round(details.spot_metrics.total_holders))
            : null,
        deployedAt:
          details?.token_details?.token_deployment_date?.slice(0, 40) ?? null,
        topHoldersPct: holders
          ? topHoldersPct(
              holders.data,
              details?.token_details?.total_supply ?? null,
            )
          : null,
        flows: flowRow
          ? {
              timeframe: flowTimeframe,
              smartTraderNetUsd: flowRow.smart_trader_net_flow_usd ?? null,
              whaleNetUsd: flowRow.whale_net_flow_usd ?? null,
              publicFigureNetUsd: flowRow.public_figure_net_flow_usd ?? null,
              freshWalletsNetUsd: flowRow.fresh_wallets_net_flow_usd ?? null,
              exchangeNetUsd: flowRow.exchange_net_flow_usd ?? null,
            }
          : null,
        sellersAfterCall: sellers
          ? sellersAfterCall(sellers.data, wallet, linked)
          : [],
      }
    : null;

  const pnlRow =
    tokenPnl?.data.find(
      (r) => r.trader_address.toLowerCase() === wallet?.toLowerCase(),
    ) ?? null;
  const onToken = pnlRow
    ? {
        realizedUsd: pnlRow.pnl_usd_realised ?? null,
        unrealizedUsd: pnlRow.pnl_usd_unrealised ?? null,
        stillHoldingRatio: pnlRow.still_holding_balance_ratio ?? null,
      }
    : null;
  const flags = token
    ? tokenFlags({ direction, callAt: callMs, token, onToken })
    : [];

  // Wallet verdict: only when a wallet, a direction and at least one answered request exist.
  const events: PositionEvent[] = [];
  let answered = false;
  for (const { target, rows } of dexResults) {
    if (!rows) continue;
    answered = true;
    events.push(...spotEvents(rows.data, target.addresses, target.chain));
  }
  if (perps && perpSymbol) {
    answered = true;
    events.push(...perpEvents(perps.data, perpSymbol));
  }
  let verdict: NansenCheck["verdict"];
  let findings: NansenCheck["findings"] = [];
  let walletNote: string;
  if (!direction) {
    verdict = "not-applicable";
    walletNote =
      "No stated direction, so the wallet is not compared with the call.";
  } else if (!wallet) {
    verdict = "unavailable";
    walletNote =
      "No verified wallet binding for this creator; there is no wallet to check.";
  } else if (!answered) {
    verdict = "unavailable";
    walletNote = "No wallet request succeeded. No wallet finding is claimed.";
  } else {
    ({ verdict, findings } = assessWalletTiming({
      asset: tokenLabel,
      direction,
      callAt: callMs,
      events,
    }));
    const span =
      callMs === null
        ? "over the last 30 days"
        : "from 7 days before to 7 days after the post";
    walletNote = `Bound wallet's DEX trades on ${chains.join(", ") || "no EVM chain"}${perps ? " and Hyperliquid perps" : ""} ${span}. One wallet never covers all of a creator's activity; observations are not proof of intent.`;
  }

  const value: NansenCheck = {
    ...base,
    mode: "live",
    verdict,
    findings,
    chain: primaryChain.slice(0, 20),
    chains: chains.slice(0, 6),
    note: walletNote.slice(0, 400),
    token,
    flags,
    walletPnl: pnlSummary
      ? {
          window: pnlWindow,
          realizedUsd: pnlSummary.realized_pnl_usd ?? null,
          tradedTokens:
            pnlSummary.traded_token_count != null
              ? Math.max(0, Math.round(pnlSummary.traded_token_count))
              : null,
          onToken,
        }
      : null,
    related: (related?.data ?? []).slice(0, 10).map((r) => ({
      address: r.address.slice(0, 64),
      label: r.address_label?.slice(0, 80) || null,
      relation: r.relation.slice(0, 60),
      chain: r.chain.slice(0, 20),
    })),
    sources: s.sources.slice(0, 24),
  };
  // Settled windows do not change; live windows refresh every 15 minutes.
  const settled = callMs !== null && callMs + 9 * 86_400_000 < now;
  if (checkCache.size >= 500) checkCache.clear();
  checkCache.set(key, {
    expires: now + (settled ? 6 * 3_600_000 : 15 * 60_000),
    value,
  });
  return value;
}
