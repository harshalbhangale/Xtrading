import { el, svg } from "./dom";

export const markPath =
  "M14 19H35Q42 19 48 27L56 38 44 49 32 36H14Q8 36 8 29Q8 19 14 19 M39 62L54 48 69 31Q76 23 85 23H94 L78 43 66 53 87 76Q94 84 85 84H69 Q63 84 57 76L48 65 35 79 Q30 84 22 84H9Z";

/** XTrading verified badge: radar scanner, corner brackets, white logo and tooltip. */
export function verifiedBadge(input: {
  size?: number;
  title: string;
  subtitle: string;
  /** Feed badges stay quiet; only the profile badge explains itself on hover. */
  tooltip?: boolean;
}) {
  const size = input.size ?? 24;
  const interactive = input.tooltip !== false;
  const badge = el("span", {
    class: `xt-badge${interactive ? "" : " xt-static"}`,
    style: `width:${size}px;height:${size}px`,
    role: "img",
    "aria-label": input.title,
    ...(interactive ? { tabindex: "0" } : { title: input.title }),
  });
  badge.append(
    el("span", { class: "xt-radar", "aria-hidden": "true" }),
    el("span", { class: "xt-corners", "aria-hidden": "true" }),
    el(
      "span",
      { class: "xt-mark", "aria-hidden": "true" },
      svg(
        "svg",
        { viewBox: "0 0 100 100" },
        svg("path", { fill: "currentColor", d: markPath }),
      ),
    ),
  );
  if (!interactive) return badge;
  badge.append(
    el(
      "span",
      { class: "xt-tooltip", role: "tooltip" },
      el(
        "span",
        { class: "xt-tooltip-title" },
        el("span", { class: "xt-tooltip-dot" }),
        input.title,
      ),
      el("span", { class: "xt-tooltip-sub" }, input.subtitle),
    ),
  );
  // The tooltip opens upward by default; flip it below when there is no room above.
  const place = () => {
    badge.classList.toggle("xt-flip", badge.getBoundingClientRect().top < 110);
  };
  badge.addEventListener("pointerenter", place);
  badge.addEventListener("focus", place);
  return badge;
}
