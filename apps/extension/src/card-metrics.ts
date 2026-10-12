import type { PublicCall } from "@call-my-bluff/domain";

export type CallStats = {
  /** Calls with a settled outcome; open and unresolved calls are not counted. */
  scored: number;
  hits: number;
  open: number;
  /** Median return in basis points per horizon, present only when that horizon has scored calls. */
  medianBps: Partial<Record<"24h" | "7d" | "30d", number>>;
};

const horizons = ["24h", "7d", "30d"] as const;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const low = sorted[mid - 1] ?? 0;
  const high = sorted[mid] ?? 0;
  return sorted.length % 2 ? high : (low + high) / 2;
}

/** Summarise a creator's registered calls. Returns null when there is nothing to show. */
export function callStats(calls: PublicCall[]): CallStats | null {
  const settled = calls.filter(
    (call) =>
      call.evidence.outcome !== null && call.evidence.returnBps !== null,
  );
  const open = calls.filter((call) => call.status === "open").length;
  if (!settled.length && !open) return null;
  const medianBps: CallStats["medianBps"] = {};
  for (const horizon of horizons) {
    const returns = settled
      .filter((call) => call.evidence.horizon === horizon)
      .map((call) => Number(call.evidence.returnBps));
    if (returns.length) medianBps[horizon] = median(returns);
  }
  return {
    scored: settled.length,
    hits: settled.filter((call) => call.evidence.outcome === "success").length,
    open,
    medianBps,
  };
}

export function formatBps(bps: number) {
  const percent = bps / 100;
  const text = Math.abs(percent).toFixed(1);
  return `${percent < 0 ? "−" : "+"}${text}%`;
}

/** "7/10 right · +3.1% at 24h · −1.2% at 7d", or an honest empty line. */
export function callsLine(stats: CallStats | null, detected: number) {
  if (!stats)
    return detected
      ? `${detected} post${detected === 1 ? "" : "s"} detected · none scored yet`
      : null;
  if (!stats.scored) return `No scored calls yet · ${stats.open} open`;
  const parts = [`${stats.hits}/${stats.scored} right`];
  for (const horizon of horizons) {
    const value = stats.medianBps[horizon];
    if (value !== undefined) parts.push(`${formatBps(value)} at ${horizon}`);
  }
  return parts.join(" · ");
}

/** Whole-unit amount from a six-decimal integer string, e.g. "500000000" -> "500". */
export function formatUnits6(raw: string) {
  const value = BigInt(raw);
  const whole = value / 1_000_000n;
  const fraction = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return fraction === "00" ? whole.toString() : `${whole}.${fraction}`;
}
