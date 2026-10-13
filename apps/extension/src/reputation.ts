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

/** Red-flag pill when evidence-backed serious flags exist. */
export function flagChip(value: KolReputation | null) {
  const flags = seriousFlags(value);
  if (!flags.length) return null;
  return el(
    "span",
    {
      class: "chip flag",
      title: flags.map((f) => f.title).join(" · "),
    },
    `⚑ ${flags.length}`,
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
