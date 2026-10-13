import type { PostSignal } from "@call-my-bluff/domain";
import { el } from "./dom";
import { callSection, loadInsights, reputationSection } from "./drawer";
import { nansenPanel } from "./nansen-panel";
import { reputation } from "./reputation";

/**
 * The evidence behind a post's trade card: what the post says, the creator's
 * record and the Nansen check. Collapsed by default and loaded on first open,
 * so scrolling X never spends Nansen credits.
 */
export function callInsights(input: {
  postId: string;
  handle: string;
  signal?: PostSignal;
}) {
  const { signal } = input;
  const call = signal?.isCall
    ? [
        signal.direction === "bullish"
          ? "Bullish"
          : signal.direction === "bearish"
            ? "Bearish"
            : "No direction",
        signal.asset,
        signal.instrument === "perp" ? "perp" : "spot",
      ]
        .filter(Boolean)
        .join(" ")
    : null;
  const body = el("div", { class: "call-insights-body" });
  const details = el(
    "details",
    { class: "call-insights" },
    el(
      "summary",
      {},
      el("span", { class: "ci-title" }, "Call check"),
      call
        ? el(
            "span",
            {
              class: `ci-chip ${signal?.direction === "bearish" ? "down" : signal?.direction === "bullish" ? "up" : ""}`,
            },
            call,
          )
        : null,
      el("span", { class: "ci-chip" }, "Creator record"),
      el("span", { class: "ci-chip" }, "Nansen"),
    ),
    body,
  ) as HTMLDetailsElement;
  let loaded = false;
  details.addEventListener("toggle", () => {
    if (!details.open || loaded) return;
    loaded = true;
    body.replaceChildren(
      el("p", { class: "note" }, "Loading Nansen check and creator record…"),
    );
    void Promise.all([
      loadInsights(
        input.handle,
        signal?.asset ?? null,
        signal?.direction ?? null,
        input.postId,
      ),
      reputation(input.handle),
    ]).then(([insights, tier]) => {
      if (!details.isConnected) return;
      body.replaceChildren(
        ...(signal?.isCall ? [callSection(signal)] : []),
        ...(insights
          ? [
              nansenPanel(insights.nansen),
              reputationSection(insights.reputation, insights, tier),
            ]
          : [
              el(
                "p",
                { class: "note" },
                "Couldn't load the creator record or Nansen check.",
              ),
            ]),
      );
    });
  });
  // Keep X from opening the post when the strip is used.
  details.addEventListener("click", (event) => event.stopPropagation());
  return details;
}
