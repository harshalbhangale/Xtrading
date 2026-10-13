import { z } from "zod";
import type { PublicCall } from "./index";

/**
 * Reputation tiers and accountability flags for a creator (KOL), computed only
 * from evidence we hold: registered calls scored under directional-return-v1,
 * repeated public-availability checks of those posts, onchain settlement
 * outcomes and the creator's own indexed swaps. Tiers set the creator's cut
 * of each buy made from their post; nothing here is a safety guarantee.
 */
/** Cut of a buy for a verified creator with a payout wallet but no tier yet. */
export const VERIFIED_FEE_BPS = 10;
export const creatorFeeRates = [10, 50, 100, 200] as const;
export type CreatorFeeBps = (typeof creatorFeeRates)[number];
export const creatorFeeBpsSchema = z.union([
  z.literal(10),
  z.literal(50),
  z.literal(100),
  z.literal(200),
]);
export const reputationTiers = [
  {
    id: "pro",
    name: "Xtrading Pro",
    feeBps: 50,
    minScored: 5,
    minHitBps: 5000,
    positiveMedian: null,
  },
  {
    id: "max",
    name: "Xtrading Max",
    feeBps: 100,
    minScored: 15,
    minHitBps: 6000,
    positiveMedian: "all",
  },
  {
    id: "ultra",
    name: "Xtrading Ultra",
    feeBps: 200,
    minScored: 30,
    minHitBps: 6500,
    positiveMedian: "7d",
  },
] as const;
export type TierId = (typeof reputationTiers)[number]["id"];

export type KolSwap = {
  market: "WETH" | "WBTC" | "MON";
  side: "buy" | "sell";
  timestamp: string;
  transactionHash: string;
};
export type KolFlag = {
  kind: "removed_post" | "counter_trade" | "mostly_wrong" | "slashed_bond";
  severity: "serious" | "warning";
  title: string;
  detail: string;
  callIds: string[];
  transactions: string[];
};
export type Requirement = {
  label: string;
  current: number;
  target: number;
  met: boolean;
};
export type KolAssessment = {
  scored: number;
  hits: number;
  open: number;
  hitBps: number | null;
  medianBps: number | null;
  median7dBps: number | null;
  availabilityChecked: number;
  flags: KolFlag[];
  earnedTier: TierId | null;
  tier: TierId | null;
  demotedBy: number;
  /** Cut of each buy from this creator's posts, in basis points. */
  feeBps: CreatorFeeBps;
  next: { id: TierId; name: string; requirements: Requirement[] } | null;
  progressBps: number;
};

const swapAsset = { WETH: "ETH", WBTC: "BTC", MON: "MON" } as const;
/** Two consecutive "not publicly available" checks; one miss can be an outage. */
const REMOVED_CONFIRMATIONS = 2;

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[mid] as number)
    : Math.trunc(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function removed(call: PublicCall) {
  const checks = call.evidence.availability ?? [];
  const latest = checks.slice(-REMOVED_CONFIRMATIONS);
  return (
    latest.length === REMOVED_CONFIRMATIONS &&
    latest.every((check) => check.status === "not-publicly-available")
  );
}

export function kolFlags(input: {
  calls: PublicCall[];
  swaps: KolSwap[];
  hitBps: number | null;
  scored: number;
}): KolFlag[] {
  const flags: KolFlag[] = [];
  const gone = input.calls.filter(removed);
  if (gone.length) {
    const wrong = gone.filter((c) => c.evidence.outcome === "failure").length;
    flags.push({
      kind: "removed_post",
      severity: "serious",
      title: `${plural(gone.length, "registered call")} no longer public`,
      detail: `X stopped serving ${gone.length === 1 ? "this post" : "these posts"} in two consecutive checks${wrong ? `; ${wrong} had resolved wrong` : ""}. Deleted, protected or suspended posts look the same from outside. The text archived at registration is kept.`,
      callIds: gone.map((c) => c.id),
      transactions: [],
    });
  }
  const counter: { call: PublicCall; swap: KolSwap }[] = [];
  for (const call of input.calls) {
    const start = Date.parse(call.publishedAt) / 1000;
    const end = Number(call.evidence.terms.expiry);
    const against = call.evidence.terms.direction === "up" ? "sell" : "buy";
    for (const swap of input.swaps) {
      const at = Number(swap.timestamp);
      if (
        swapAsset[swap.market] === call.evidence.terms.assetId &&
        swap.side === against &&
        at >= start &&
        at <= end
      )
        counter.push({ call, swap });
    }
  }
  if (counter.length) {
    const calls = [...new Set(counter.map((c) => c.call.id))];
    flags.push({
      kind: "counter_trade",
      severity: "serious",
      title: `Traded against ${plural(calls.length, "own call")}`,
      detail:
        "The creator's bound wallet swapped in the opposite direction of an open call on the same asset (Kuru fills indexed by Envio). Hedging is possible; the swaps are shown as recorded.",
      callIds: calls,
      transactions: [...new Set(counter.map((c) => c.swap.transactionHash))],
    });
  }
  if (input.scored >= 5 && input.hitBps !== null && input.hitBps < 4000)
    flags.push({
      kind: "mostly_wrong",
      severity: "warning",
      title: "Mostly wrong",
      detail: `${Math.round(input.hitBps / 100)}% of ${input.scored} scored calls were right.`,
      callIds: [],
      transactions: [],
    });
  const slashed = input.calls.filter((c) => c.bond?.status === "failure");
  if (slashed.length)
    flags.push({
      kind: "slashed_bond",
      severity: "warning",
      title: `${plural(slashed.length, "bonded call")} slashed`,
      detail:
        "Chainlink CRE settled these bonded calls as wrong and the bond went to the reward pool.",
      callIds: slashed.map((c) => c.id),
      transactions: slashed.flatMap((c) =>
        c.bond?.settledTx ? [c.bond.settledTx] : [],
      ),
    });
  return flags;
}

function requirements(
  tier: (typeof reputationTiers)[number],
  stats: {
    scored: number;
    hitBps: number | null;
    medianBps: number | null;
    median7dBps: number | null;
  },
): Requirement[] {
  const list: Requirement[] = [
    {
      label: "Scored calls",
      current: stats.scored,
      target: tier.minScored,
      met: stats.scored >= tier.minScored,
    },
    {
      label: "Calls right (%)",
      current: Math.floor((stats.hitBps ?? 0) / 100),
      target: tier.minHitBps / 100,
      met: (stats.hitBps ?? 0) >= tier.minHitBps,
    },
  ];
  if (tier.positiveMedian) {
    const value =
      tier.positiveMedian === "7d" ? stats.median7dBps : stats.medianBps;
    list.push({
      label:
        tier.positiveMedian === "7d"
          ? "Positive median return at 7d"
          : "Positive median return",
      current: value !== null && value > 0 ? 1 : 0,
      target: 1,
      met: value !== null && value > 0,
    });
  }
  return list;
}

export function assessKol(input: {
  calls: PublicCall[];
  swaps: KolSwap[];
}): KolAssessment {
  const settled = input.calls.filter(
    (c) => c.evidence.outcome !== null && c.evidence.returnBps !== null,
  );
  const scored = settled.length;
  const hits = settled.filter((c) => c.evidence.outcome === "success").length;
  const hitBps = scored ? Math.floor((hits * 10000) / scored) : null;
  const returns = settled.map((c) => Number(c.evidence.returnBps));
  const stats = {
    scored,
    hitBps,
    medianBps: median(returns),
    median7dBps: median(
      settled
        .filter((c) => c.evidence.horizon === "7d")
        .map((c) => Number(c.evidence.returnBps)),
    ),
  };
  const flags = kolFlags({ ...input, hitBps, scored });
  let earned = -1;
  reputationTiers.forEach((tier, index) => {
    if (requirements(tier, stats).every((r) => r.met)) earned = index;
  });
  // Each distinct serious flag costs one tier.
  const demotedBy = new Set(
    flags.filter((f) => f.severity === "serious").map((f) => f.kind),
  ).size;
  const level = earned - demotedBy;
  const tier = level >= 0 ? reputationTiers[level] : null;
  const nextTier = reputationTiers[earned + 1] ?? null;
  const next = nextTier
    ? {
        id: nextTier.id,
        name: nextTier.name,
        requirements: requirements(nextTier, stats),
      }
    : null;
  const progressBps = next
    ? Math.floor(
        next.requirements.reduce(
          (sum, r) =>
            sum + Math.min(10000, Math.floor((r.current * 10000) / r.target)),
          0,
        ) / next.requirements.length,
      )
    : 10000;
  return {
    ...stats,
    hits,
    open: input.calls.filter((c) => c.status === "open").length,
    availabilityChecked: input.calls.filter(
      (c) => (c.evidence.availability ?? []).length > 0,
    ).length,
    flags,
    earnedTier: earned >= 0 ? (reputationTiers[earned]?.id ?? null) : null,
    tier: tier?.id ?? null,
    demotedBy: earned >= 0 ? Math.min(demotedBy, earned + 1) : 0,
    feeBps: tier?.feeBps ?? VERIFIED_FEE_BPS,
    next,
    progressBps,
  };
}

export function tierName(id: TierId | null) {
  return reputationTiers.find((t) => t.id === id)?.name ?? null;
}
