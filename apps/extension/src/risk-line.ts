import type { NansenCheck, PostSignal } from "@call-my-bluff/domain";
import { el, safeLink } from "./dom";
import { loadInsights } from "./drawer";

export type RiskVerdict = {
  tone: "risky" | "clean" | "unknown";
  text: string;
};

/**
 * One line before a trade, from the Nansen check. "No red flags" means none in
 * the data Nansen returned — never a guarantee that a trade is safe.
 */
export function riskVerdict(check: NansenCheck | null): RiskVerdict {
  if (check?.mode !== "live")
    return { tone: "unknown", text: "Not checked — Nansen unavailable" };
  const frontRun = check.findings.find((f) => f.kind === "front-run");
  if (frontRun)
    return {
      tone: "risky",
      text: "Risky: creator bought before the post and sold after",
    };
  const caution = (check.flags ?? []).filter((f) => f.severity === "caution");
  if (caution[0])
    return {
      tone: "risky",
      text: `Risky: ${caution[0].summary.replace(/\.$/, "")}${caution.length > 1 ? ` (+${caution.length - 1} more)` : ""}`,
    };
  if (check.verdict === "contradiction")
    return {
      tone: "risky",
      text: "Risky: creator's wallet traded against this call",
    };
  const answered = (check.sources ?? []).some(
    (s) => s.status === "ok" || s.status === "empty",
  );
  if (!answered)
    return { tone: "unknown", text: "Not checked — no Nansen data returned" };
  return { tone: "clean", text: "No red flags in Nansen data" };
}

/** Nansen's own page for the checked token, for details. */
export function nansenLink(check: NansenCheck | null) {
  const token = check?.token;
  if (token && /^0x[0-9a-fA-F]{40}$/.test(token.address))
    return `https://app.nansen.ai/token-god-mode?chain=${encodeURIComponent(token.chain)}&tokenAddress=${token.address}`;
  if (check?.wallet)
    return `https://app.nansen.ai/profiler?address=${check.wallet}`;
  return null;
}

/**
 * The pre-trade line. Loads on first `load()` (when the trade panel opens), so
 * scrolling never spends Nansen credits.
 */
export function riskLine(input: {
  postId: string;
  handle: string;
  asset: string | null;
  signal?: PostSignal;
}) {
  const line = el(
    "p",
    { class: "risk-line unknown", role: "status" },
    "Checking Nansen…",
  );
  let started = false;
  return {
    line,
    load() {
      if (started) return;
      started = true;
      void loadInsights(
        input.handle,
        input.signal?.asset ?? input.asset,
        input.signal?.direction ?? null,
        input.postId,
      ).then((insights) => {
        const check = insights?.nansen ?? null;
        const verdict = riskVerdict(check);
        const link = nansenLink(check);
        line.className = `risk-line ${verdict.tone}`;
        line.replaceChildren(
          el(
            "span",
            { class: "risk-dot", "aria-hidden": "true" },
            verdict.tone === "risky"
              ? "!"
              : verdict.tone === "clean"
                ? "✓"
                : "?",
          ),
          el("span", {}, verdict.text),
          ...(link ? [safeLink(link, "Nansen ↗", "risk-link")] : []),
        );
      });
    },
  };
}
