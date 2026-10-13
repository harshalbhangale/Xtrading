import type {
  NansenCheck,
  NansenFlag,
  NansenToken,
  PostSignal,
} from "@call-my-bluff/domain";
import { z } from "zod";

/** Nansen's placeholder for an EVM chain's native coin (ETH on ethereum, MON on monad). */
export const EVM_NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const ZERO = "0x0000000000000000000000000000000000000000";

export type MajorTarget = {
  chain: string;
  symbol: string;
  // Lowercase. A wallet trade matches when it bought or sold one of these.
  addresses: string[];
};

/**
 * Mainnet contracts a major-asset call is checked against. Explicit per chain:
 * a symbol alone never identifies a token. SOL is absent because the bound
 * wallet is EVM and Solana addresses differ.
 */
export const MAJOR_TARGETS: Record<string, MajorTarget[]> = {
  ETH: [
    {
      chain: "ethereum",
      symbol: "WETH",
      addresses: [
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        EVM_NATIVE,
        ZERO,
      ],
    },
    {
      chain: "base",
      symbol: "WETH",
      addresses: [
        "0x4200000000000000000000000000000000000006",
        EVM_NATIVE,
        ZERO,
      ],
    },
    {
      chain: "arbitrum",
      symbol: "WETH",
      addresses: [
        "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
        EVM_NATIVE,
        ZERO,
      ],
    },
  ],
  BTC: [
    {
      chain: "ethereum",
      symbol: "WBTC",
      addresses: [
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
        // cbBTC uses the same address on Ethereum and Base.
        "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
      ],
    },
    {
      chain: "base",
      symbol: "cbBTC",
      addresses: ["0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf"],
    },
    {
      chain: "arbitrum",
      symbol: "WBTC",
      addresses: ["0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f"],
    },
  ],
  MON: [
    {
      chain: "monad",
      symbol: "WMON",
      addresses: [
        "0x3bd359c1119da7da1d913d1c4d2b7c461115433a",
        EVM_NATIVE,
        ZERO,
      ],
    },
  ],
};

/** Hyperliquid perp symbols checked for a call. Other assets are matched by their own ticker. */
export const PERP_MAJORS = new Set(["BTC", "ETH", "SOL", "MON"]);

/** Chains tried, in order, to locate an EVM contract named in a post. */
export const EVM_TOKEN_CHAINS = [
  "monad",
  "base",
  "ethereum",
  "bnb",
  "arbitrum",
] as const;

const DAY = 86_400_000;
export const CALL_WINDOW_MS = 7 * DAY;
export const SELLERS_WINDOW_MS = 2 * DAY;

/** Wallet window: 7 days either side of the post, or the last 30 days without a post time. */
export function walletWindow(callAt: number | null, now: number) {
  if (callAt === null)
    return {
      from: new Date(now - 30 * DAY).toISOString(),
      to: new Date(now).toISOString(),
    };
  return {
    from: new Date(callAt - CALL_WINDOW_MS).toISOString(),
    to: new Date(Math.min(callAt + CALL_WINDOW_MS, now)).toISOString(),
  };
}

// Nansen marks many fields optional or nullable; parse leniently, validate types.
const num = z.number().finite().nullable().optional();
const str = z.string().nullable().optional();
const page = z.object({ is_last_page: z.boolean().optional() }).optional();

export const dexTradesResponse = z.object({
  pagination: page,
  data: z
    .array(
      z.object({
        block_timestamp: z.string(),
        transaction_hash: z.string(),
        token_bought_address: str,
        token_sold_address: str,
        token_bought_symbol: str,
        token_sold_symbol: str,
        trade_value_usd: num,
      }),
    )
    .max(1000),
});
export const perpTradesResponse = z.object({
  pagination: page,
  data: z
    .array(
      z.object({
        timestamp: z.string(),
        side: str,
        action: str,
        token_symbol: str,
        value_usd: num,
        transaction_hash: str,
      }),
    )
    .max(1000),
});
export const tokenInformationResponse = z.object({
  data: z
    .object({
      name: str,
      symbol: str,
      token_details: z
        .object({
          token_deployment_date: str,
          market_cap_usd: num,
          total_supply: num,
        })
        .nullable()
        .optional(),
      spot_metrics: z
        .object({ liquidity_usd: num, total_holders: num })
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
});
export const holdersResponse = z.object({
  data: z
    .array(
      z.object({
        address: str,
        address_label: str,
        token_amount: num,
      }),
    )
    .max(200),
});
export const whoBoughtSoldResponse = z.object({
  data: z
    .array(
      z.object({
        address: z.string(),
        address_label: str,
        bought_volume_usd: num,
        sold_volume_usd: num,
      }),
    )
    .max(200),
});
export const flowIntelligenceResponse = z.object({
  data: z
    .array(
      z.object({
        smart_trader_net_flow_usd: num,
        whale_net_flow_usd: num,
        public_figure_net_flow_usd: num,
        fresh_wallets_net_flow_usd: num,
        fresh_wallets_wallet_count: num,
        exchange_net_flow_usd: num,
      }),
    )
    .max(10),
});
export const pnlLeaderboardResponse = z.object({
  data: z
    .array(
      z.object({
        trader_address: z.string(),
        pnl_usd_realised: num,
        pnl_usd_unrealised: num,
        still_holding_balance_ratio: num,
      }),
    )
    .max(100),
});
export const relatedWalletsResponse = z.object({
  data: z
    .array(
      z.object({
        address: z.string(),
        address_label: str,
        relation: z.string(),
        chain: z.string(),
      }),
    )
    .max(100),
});
export const pnlSummaryResponse = z.object({
  realized_pnl_usd: num,
  traded_token_count: num,
});

/** One wallet action on the called asset, spot (DEX) or perp (Hyperliquid). */
export type PositionEvent = {
  venue: "spot" | "perp";
  chain: string;
  action:
    | "buy"
    | "sell"
    | "open-long"
    | "close-long"
    | "open-short"
    | "close-short";
  valueUsd: number | null;
  at: string;
  transactionHash: string | null;
};

export function spotEvents(
  rows: z.infer<typeof dexTradesResponse>["data"],
  addresses: string[],
  chain: string,
): PositionEvent[] {
  const match = new Set(addresses.map((a) => a.toLowerCase()));
  const events: PositionEvent[] = [];
  for (const row of rows) {
    const bought = match.has(row.token_bought_address?.toLowerCase() ?? "");
    const sold = match.has(row.token_sold_address?.toLowerCase() ?? "");
    // Wrapping or a same-asset swap is not a position change.
    if (bought === sold) continue;
    events.push({
      venue: "spot",
      chain,
      action: bought ? "buy" : "sell",
      valueUsd: row.trade_value_usd ?? null,
      at: row.block_timestamp,
      transactionHash: row.transaction_hash,
    });
  }
  return events;
}

export function perpEvents(
  rows: z.infer<typeof perpTradesResponse>["data"],
  asset: string,
): PositionEvent[] {
  const events: PositionEvent[] = [];
  for (const row of rows) {
    if (row.token_symbol?.toUpperCase() !== asset.toUpperCase()) continue;
    const long = row.side === "Long";
    if (!long && row.side !== "Short") continue;
    // Liquidations are forced, not a stated choice; leave them out.
    const action = row.action ?? "";
    const open = /open|add/i.test(action);
    if (!open && !/close|reduce/i.test(action)) continue;
    events.push({
      venue: "perp",
      chain: "hyperliquid",
      action: open
        ? long
          ? "open-long"
          : "open-short"
        : long
          ? "close-long"
          : "close-short",
      valueUsd: row.value_usd ?? null,
      at: row.timestamp,
      transactionHash: row.transaction_hash ?? null,
    });
  }
  return events;
}

const WITH_BULLISH = new Set(["buy", "open-long", "close-short"]);
function withCall(
  event: PositionEvent,
  direction: "bullish" | "bearish",
): boolean {
  const bullishSide = WITH_BULLISH.has(event.action);
  return direction === "bullish" ? bullishSide : !bullishSide;
}

const money = (value: number) =>
  `$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
function relative(at: string, callAt: number | null) {
  const time = Date.parse(at);
  if (callAt === null || !Number.isFinite(time)) return "";
  const hours = Math.round((time - callAt) / 3_600_000);
  const span =
    Math.abs(hours) < 48
      ? `${Math.abs(hours)}h`
      : `${Math.round(Math.abs(hours) / 24)}d`;
  return hours < 0 ? ` · ${span} before the post` : ` · ${span} after the post`;
}
const ACTION_TEXT: Record<PositionEvent["action"], string> = {
  buy: "Bought",
  sell: "Sold",
  "open-long": "Opened long",
  "close-long": "Closed long",
  "open-short": "Opened short",
  "close-short": "Closed short",
};

/**
 * Said versus did around the post. The core pattern is positioning with the
 * call before posting and exiting against it after. Observations, not proof:
 * one wallet never covers all of a creator's activity.
 */
export function assessWalletTiming(input: {
  asset: string;
  direction: "bullish" | "bearish";
  callAt: number | null;
  events: PositionEvent[];
}): Pick<NansenCheck, "verdict" | "findings"> {
  const asset = input.asset.toUpperCase();
  const events = [...input.events].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  if (events.length === 0)
    return {
      verdict: "no-activity",
      findings: [
        {
          kind: "no-activity",
          summary: `No ${asset} trades observed for the bound wallet in this window.`,
          transactionHash: null,
          observedAt: null,
          chain: null,
        },
      ],
    };
  const sum = (list: PositionEvent[]) =>
    list.reduce((total, e) => total + (e.valueUsd ?? 0), 0);
  const before =
    input.callAt === null
      ? []
      : events.filter((e) => Date.parse(e.at) < (input.callAt as number));
  const after = events.filter((e) => !before.includes(e));
  const withBefore = before.filter((e) => withCall(e, input.direction));
  const againstBefore = before.filter((e) => !withCall(e, input.direction));
  const withAfter = after.filter((e) => withCall(e, input.direction));
  const againstAfter = after.filter((e) => !withCall(e, input.direction));

  const findings: NansenCheck["findings"] = [];
  // Exits worth at least half the pre-post position (or unpriced) count.
  const frontRun =
    withBefore.length > 0 &&
    againstAfter.length > 0 &&
    (sum(withBefore) === 0 || sum(againstAfter) >= sum(withBefore) * 0.5);
  if (frontRun) {
    const exit = againstAfter[0] as PositionEvent;
    findings.push({
      kind: "front-run",
      summary: `Positioned ${input.direction === "bullish" ? "long" : "short"} ${asset} before the post (~${money(sum(withBefore))}), then exited against the call after it (~${money(sum(againstAfter))}).`,
      transactionHash: exit.transactionHash,
      observedAt: exit.at,
      chain: exit.chain,
      stance: "against",
      valueUsd: sum(againstAfter),
    });
  }
  for (const event of [...againstAfter, ...withAfter, ...before]) {
    if (findings.length >= 9) break;
    findings.push({
      kind:
        event.venue === "perp"
          ? event.action.endsWith("long")
            ? "perp-long"
            : "perp-short"
          : event.action === "sell"
            ? "sold-asset"
            : "bought-asset",
      summary: `${ACTION_TEXT[event.action]} ${asset}${event.venue === "perp" ? " perp" : ""} on ${event.chain}${event.valueUsd === null ? "" : ` (~${money(event.valueUsd)})`}${relative(event.at, input.callAt)}`,
      transactionHash: event.transactionHash,
      observedAt: event.at,
      chain: event.chain,
      stance: withCall(event, input.direction) ? "with" : "against",
      valueUsd: event.valueUsd,
    });
  }
  if (frontRun || (after.length && sum(againstAfter) > sum(withAfter)))
    return { verdict: "contradiction", findings };
  if (after.length) return { verdict: "consistent", findings };
  // Only pre-post activity: aligned positioning is consistent; the reverse is just noted.
  if (sum(withBefore) >= sum(againstBefore))
    return { verdict: "consistent", findings };
  findings.unshift({
    kind: "note",
    summary: `Only pre-post activity, net against the call. Nothing observed after the post.`,
    transactionHash: null,
    observedAt: null,
    chain: null,
  });
  return { verdict: "no-activity", findings: findings.slice(0, 10) };
}

const EXCLUDED_HOLDER =
  /exchange|pool|\blp\b|liquidity|uniswap|pancake|aerodrome|velodrome|kuru|router|vault|bridge|burn|dead|null|treasury|vesting|staking/i;
const DEAD = new Set([ZERO, "0x000000000000000000000000000000000000dead"]);

/** Top-10 share of supply, leaving out labelled exchanges, pools, bridges and burns. */
export function topHoldersPct(
  rows: z.infer<typeof holdersResponse>["data"],
  totalSupply: number | null,
): number | null {
  const kept = rows
    .filter(
      (row) =>
        !DEAD.has(row.address?.toLowerCase() ?? "") &&
        !EXCLUDED_HOLDER.test(row.address_label ?? ""),
    )
    .sort((a, b) => (b.token_amount ?? 0) - (a.token_amount ?? 0))
    .slice(0, 10);
  // ownership_percentage's scale is undocumented, so only token amounts over supply count.
  if (!kept.length || !totalSupply || totalSupply <= 0) return null;
  const pct =
    (kept.reduce((t, r) => t + (r.token_amount ?? 0), 0) / totalSupply) * 100;
  return Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : null;
}

export function sellersAfterCall(
  rows: z.infer<typeof whoBoughtSoldResponse>["data"],
  wallet: string | null,
  linked: Set<string>,
): NansenToken["sellersAfterCall"] {
  const me = wallet?.toLowerCase();
  return rows
    .map((row) => ({
      address: row.address.slice(0, 64),
      label: row.address_label?.slice(0, 80) || null,
      soldUsd: row.sold_volume_usd ?? 0,
      boughtUsd: row.bought_volume_usd ?? 0,
      isCreator: row.address.toLowerCase() === me,
      isLinked: linked.has(row.address.toLowerCase()),
    }))
    .filter((row) => row.soldUsd > row.boughtUsd)
    .sort((a, b) => b.soldUsd - a.soldUsd)
    .slice(0, 5);
}

const FLOW_MIN_USD = 10_000;

/** Token and wallet observations. Severity marks what deserves a look, not a verdict. */
export function tokenFlags(input: {
  direction: PostSignal["direction"];
  callAt: number | null;
  token: Pick<
    NansenToken,
    | "symbol"
    | "origin"
    | "liquidityUsd"
    | "deployedAt"
    | "topHoldersPct"
    | "flows"
    | "sellersAfterCall"
  >;
  onToken: {
    realizedUsd: number | null;
    stillHoldingRatio: number | null;
  } | null;
}): NansenFlag[] {
  const flags: NansenFlag[] = [];
  const { token } = input;
  const name = token.symbol ?? "this token";
  if (token.topHoldersPct !== null && token.topHoldersPct >= 25)
    flags.push({
      kind: "holder-concentration",
      severity: token.topHoldersPct >= 50 ? "caution" : "info",
      summary: `Top 10 holders (excluding labelled exchanges and pools) hold ${token.topHoldersPct.toFixed(1)}% of supply.`,
    });
  if (token.origin === "post") {
    if (token.liquidityUsd !== null && token.liquidityUsd < 50_000)
      flags.push({
        kind: "thin-liquidity",
        severity: "caution",
        summary: `DEX liquidity is about ${money(token.liquidityUsd)}; large exits move the price sharply.`,
      });
    const deployed = token.deployedAt ? Date.parse(token.deployedAt) : NaN;
    const reference = input.callAt ?? Date.now();
    if (Number.isFinite(deployed) && reference - deployed < 14 * DAY)
      flags.push({
        kind: "young-token",
        severity: "info",
        summary: `${name} was deployed ${Math.max(0, Math.round((reference - deployed) / DAY))} days before the post.`,
      });
  }
  const flows = token.flows;
  if (flows) {
    // Flows "against" a bullish call are net outflows, and the reverse for bearish.
    const against = (value: number | null) =>
      value !== null &&
      Math.abs(value) >= FLOW_MIN_USD &&
      (input.direction === "bearish" ? value > 0 : value < 0);
    const word = (value: number) => (value < 0 ? "net sold" : "net bought");
    if (against(flows.smartTraderNetUsd))
      flags.push({
        kind: "smart-money-exit",
        severity: input.direction ? "caution" : "info",
        summary: `Smart traders ${word(flows.smartTraderNetUsd as number)} ~${money(flows.smartTraderNetUsd as number)} of ${name} (${flows.timeframe}, current).`,
      });
    if (against(flows.whaleNetUsd))
      flags.push({
        kind: "whale-exit",
        severity: "info",
        summary: `Whales ${word(flows.whaleNetUsd as number)} ~${money(flows.whaleNetUsd as number)} of ${name} (${flows.timeframe}, current).`,
      });
    const fresh = flows.freshWalletsNetUsd;
    if (
      token.origin === "post" &&
      fresh !== null &&
      fresh >= FLOW_MIN_USD &&
      fresh > Math.max(0, flows.smartTraderNetUsd ?? 0)
    )
      flags.push({
        kind: "fresh-wallet-inflow",
        severity: "info",
        summary: `Newly created wallets were bigger net buyers (~${money(fresh)}) than smart traders (${flows.timeframe}).`,
      });
  }
  const creatorSale = token.sellersAfterCall.find((s) => s.isCreator);
  if (creatorSale)
    flags.push({
      kind: "creator-sold-after-call",
      severity: "caution",
      summary: `The bound wallet was among the largest net sellers within 48h of the post (~${money(creatorSale.soldUsd)} sold).`,
    });
  const linkedSale = token.sellersAfterCall.find((s) => s.isLinked);
  if (linkedSale)
    flags.push({
      kind: "linked-wallet-sold",
      severity: "caution",
      summary: `A wallet Nansen relates to the bound wallet net sold ~${money(linkedSale.soldUsd)} within 48h of the post. A relation is a possible link, not proof of control.`,
    });
  const onToken = input.onToken;
  if (
    input.direction === "bullish" &&
    onToken?.realizedUsd != null &&
    onToken.realizedUsd > 0 &&
    onToken.stillHoldingRatio != null &&
    onToken.stillHoldingRatio < 0.25
  )
    flags.push({
      kind: "creator-took-profit",
      severity: "caution",
      summary: `The bound wallet realized ~${money(onToken.realizedUsd)} on ${name} and holds ${Math.round(onToken.stillHoldingRatio * 100)}% of its peak balance.`,
    });
  return flags.slice(0, 10);
}

const CHAIN_NAMES: Record<string, string> = {
  monad: "Monad",
  base: "Base",
  ethereum: "Ethereum",
  bnb: "BNB Chain",
  arbitrum: "Arbitrum",
  solana: "Solana",
};
export const chainName = (chain: string) => CHAIN_NAMES[chain] ?? chain;
export function chainList(chains: readonly string[]) {
  const names = chains.map(chainName);
  return names.length > 1
    ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`
    : (names[0] ?? "");
}
const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Original mainnet contracts for tickers that are commonly impersonated, each
 * checked onchain. Lowercase. A ticker missing here is never called fake.
 */
export const CANONICAL_TOKENS: Record<
  string,
  { chain: string; address: string }[]
> = {
  PEPE: [
    {
      chain: "ethereum",
      address: "0x6982508145454ce325ddbe47a25d4ec3d2311933",
    },
  ],
  SHIB: [
    {
      chain: "ethereum",
      address: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",
    },
  ],
  USDT: [
    {
      chain: "ethereum",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    },
  ],
  USDC: [
    {
      chain: "ethereum",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    { chain: "base", address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" },
    { chain: "monad", address: "0x754704bc059f8c67012fed69bc8a327a5aafb603" },
  ],
  ...Object.fromEntries(
    Object.entries(MAJOR_TARGETS).map(([asset, targets]) => [
      asset,
      targets.flatMap((t) =>
        t.addresses
          .filter((a) => a !== EVM_NATIVE && a !== ZERO)
          .map((address) => ({ chain: t.chain, address })),
      ),
    ]),
  ),
};

/**
 * Registry-only check, no provider call: the post names a ticker we hold the
 * original contract for, and shares a different address. It cannot tell a
 * bridged copy from a fake, so it is worded as unverified, never as fake.
 */
export function offRegistryContract(asset: string | null, address: string) {
  const symbol = asset?.toUpperCase() ?? null;
  const originals = symbol ? (CANONICAL_TOKENS[symbol] ?? []) : [];
  const first = originals[0];
  if (!first || originals.some((o) => o.address === address.toLowerCase()))
    return null;
  return `The post names ${symbol} but shares ${short(address.toLowerCase())}; the original ${symbol} is ${short(first.address)} on ${chainName(first.chain)}.`;
}

/**
 * Flags for a contract address shared in a post: does it belong to the token
 * the post names, and does it exist anywhere with value? Absence of data only
 * counts when every lookup answered.
 */
export function addressFlags(input: {
  asset: string | null;
  address: string;
  // Nansen's answer for the address, if any chain knew it.
  resolved: { chain: string; symbol: string | null } | null;
  // True only when every mainnet lookup answered "no such token".
  unknownOnMainnets: boolean;
  checkedChains: readonly string[];
  // Contract found on Monad testnet, with its self-reported symbol.
  testnet: { symbol: string | null } | null;
}): NansenFlag[] {
  const flags: NansenFlag[] = [];
  const asset = input.asset?.toUpperCase() ?? null;
  const address = input.address.toLowerCase();
  const originals = asset ? (CANONICAL_TOKENS[asset] ?? []) : [];
  if (originals.some((o) => o.address === address)) return flags;
  const first = originals[0];
  const original = first
    ? `${short(first.address)} on ${chainName(first.chain)}`
    : null;
  const real = original ? ` The real ${asset} is ${original}.` : "";
  const named = input.resolved?.symbol?.toUpperCase() ?? null;
  if (asset && original && !input.resolved && input.unknownOnMainnets)
    flags.push({
      kind: "impostor-token",
      severity: "caution",
      summary: `The post says ${asset}, but this isn't ${asset}'s contract.${real}`,
    });
  else if (asset && named && named !== asset)
    flags.push({
      kind: "impostor-token",
      severity: "caution",
      summary: `The post says ${asset}, but Nansen identifies this address as ${named}.${real}`,
    });
  else if (asset && original && named === asset)
    flags.push({
      kind: "not-canonical",
      severity: "info",
      summary: `Not the original ${asset} contract (${original}). It may be a bridged copy or a copycat.`,
    });
  if (input.unknownOnMainnets && input.testnet)
    flags.push({
      kind: "testnet-only-contract",
      severity: "caution",
      summary: `This contract is on Monad testnet${input.testnet.symbol ? `, calling itself ${input.testnet.symbol.slice(0, 12)}` : ""}. Testnet tokens have no value.`,
    });
  if (
    input.unknownOnMainnets &&
    !flags.some((f) => f.kind === "impostor-token")
  )
    flags.push({
      kind: "unknown-contract",
      severity: "caution",
      summary: `Nansen knows no token at this address on ${chainList(input.checkedChains)}.`,
    });
  return flags;
}
