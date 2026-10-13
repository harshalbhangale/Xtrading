import { type KolReputation, kolReputationSchema } from "@call-my-bluff/domain";
import { el, send } from "./dom";

const names = { pro: "PRO", max: "MAX", ultra: "ULTRA" } as const;
const requests = new Map<string, Promise<KolReputation | null>>();

/** Cached per page for a minute; null when unavailable (never "no flags"). */
export function reputation(handle: string) {
  let request = requests.get(handle);
  if (!request) {
    if (requests.size > 300) requests.clear();
    request = send<unknown>({ type: "creator-reputation", handle }).then(
      (raw) => {
        const parsed = kolReputationSchema.safeParse(raw);
        return parsed.success ? parsed.data : null;
      },
    );
    requests.set(handle, request);
    setTimeout(() => requests.delete(handle), 60000);
  }
  return request;
}

export function seriousFlags(value: KolReputation | null) {
  return value?.assessment.flags.filter((f) => f.severity === "serious") ?? [];
}

/** Compact tier pill, e.g. "PRO · 0.5%"; null below Pro. */
export function tierChip(value: KolReputation | null) {
  const tier = value?.assessment.tier;
  if (!tier) return null;
  return el(
    "span",
    {
      class: `chip tier tier-${tier}`,
      title: `Xtrading ${names[tier]} · earns ${value.assessment.feeBps / 100}% of each buy from their posts`,
    },
    names[tier],
  );
}

/** Two consecutive missing-public-post checks; null means no checked coverage. */
export function deletedTweetCount(value: KolReputation | null) {
  const coverage = value?.postAvailability;
  return coverage && coverage.checked > 0 ? coverage.missing : null;
}

/** Posts missing in their latest check only; awaiting a confirming re-check. */
export function suspectedTweetCount(value: KolReputation | null) {
  const coverage = value?.postAvailability;
  return coverage && coverage.checked > 0 ? coverage.suspected : null;
}

export function deletedTweetsLabel(value: KolReputation | null) {
  const count = deletedTweetCount(value);
  if (count === null) return "Unavailable — no checked posts";
  const suspected = suspectedTweetCount(value) ?? 0;
  return suspected ? `${count} · ${suspected} missing once` : String(count);
}

/** Count tweets, not flag categories. Unknown coverage never becomes zero. */
export function flagChip(value: KolReputation | null) {
  const count = deletedTweetCount(value);
  if (count === null || count === 0) return null;
  const coverage = value?.postAvailability;
  return el(
    "span",
    {
      class: "chip flag",
      title: `${count} of ${coverage?.checked} checked posts are no longer on X.`,
    },
    `${count} deleted tweet${count === 1 ? "" : "s"}`,
  );
}

export function tierLabel(value: KolReputation) {
  const { tier, feeBps, next, progressBps } = value.assessment;
  const base = tier
    ? `Xtrading ${names[tier]} · ${feeBps / 100}% per buy`
    : `No tier · ${feeBps / 100}% per buy`;
  return next
    ? `${base} · ${Math.floor(progressBps / 100)}% to ${next.name}`
    : base;
}
