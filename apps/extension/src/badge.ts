import { el } from "./dom";

/** Animated Tradepost verified badge: TP logo tile, orbiting rings, sparks and tooltip. */
export function verifiedBadge(input: {
  size?: number;
  title: string;
  subtitle: string;
  /** Feed badges stay quiet; only the profile badge explains itself on hover. */
  tooltip?: boolean;
}) {
  const size = input.size ?? 32;
  const interactive = input.tooltip !== false;
  const badge = el("span", {
    class: `tp-badge${interactive ? "" : " tp-static"}`,
    style: `width:${size}px;height:${size}px`,
    role: "img",
    "aria-label": input.title,
    ...(interactive ? { tabindex: "0" } : { title: input.title }),
  });
  badge.append(
    el("span", { class: "tp-aura" }),
    el("span", { class: "tp-ring tp-ring-a" }),
    el("span", { class: "tp-ring tp-ring-b" }),
    el(
      "span",
      { class: "tp-logo" },
      el("span", { class: "tp-mark" }, "TP"),
      el("span", { class: "tp-sweep" }),
    ),
    el("span", { class: "tp-spark tp-spark-a" }),
    el("span", { class: "tp-spark tp-spark-b" }),
  );
  if (input.tooltip !== false)
    badge.append(
      el(
        "span",
        { class: "tp-tooltip", role: "tooltip" },
        el(
          "span",
          { class: "tp-tooltip-heading" },
          el("span", { class: "tp-mini-logo" }, "TP"),
          input.title,
          el("span", { class: "tp-check" }, "✓"),
        ),
        el("span", { class: "tp-tooltip-sub" }, input.subtitle),
      ),
    );
  if (!interactive) return badge;
  // The tooltip opens upward by default; flip it below when there is no room above.
  const place = () => {
    badge.classList.toggle("tp-flip", badge.getBoundingClientRect().top < 110);
  };
  badge.addEventListener("pointerenter", place);
  badge.addEventListener("focus", place);
  return badge;
}
