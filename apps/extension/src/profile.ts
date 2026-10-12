import { normalizeHandle } from "@call-my-bluff/domain";
import { appOrigin } from "./config";
import { el, safeLink, shadowHost, shortAddress } from "./dom";
import { loadInsights } from "./drawer";
import { renderOverview } from "./overview";

const reserved = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "i",
  "settings",
  "search",
  "compose",
  "jobs",
  "lists",
  "communities",
  "premium",
  "tos",
  "privacy",
]);
function profileHandle() {
  const [first, ...rest] = location.pathname.split("/").filter(Boolean);
  if (!first || reserved.has(first.toLowerCase()) || rest.length > 1)
    return null;
  if (
    rest.length &&
    ![
      "with_replies",
      "media",
      "likes",
      "highlights",
      "articles",
      "superfollows",
    ].includes(rest[0] ?? "")
  )
    return null;
  return normalizeHandle(first);
}

/** Profile header only; ordinary posts never receive creator panels. */
export async function scanProfile() {
  const handle = profileHandle();
  let existing = document.querySelector<HTMLElement>(".cmb-profile-host");
  if (existing && existing.dataset.handle !== handle) {
    existing.remove();
    existing = null;
  }
  if (!handle) return;
  const anchor = document.querySelector<HTMLElement>(
    '[data-testid="primaryColumn"] [data-testid="UserName"]',
  );
  if (!anchor) return;
  if (existing && Number(existing.dataset.refreshAt) > Date.now()) return;
  const expanded = existing?.dataset.expanded === "true";
  existing?.remove();
  const { host, root } = shadowHost("cmb-profile-host");
  host.dataset.handle = handle;
  host.dataset.refreshAt = String(Date.now() + 60_000);
  host.style.display = "block";
  const card = el(
    "div",
    { class: "card" },
    el("div", { class: "title" }, "Tradepost · creator record"),
  );
  const details = el(
    "div",
    {},
    el("p", { class: "note" }, "Checking recorded evidence…"),
  );
  card.append(
    details,
    safeLink(
      new URL(`/creators/${handle}`, appOrigin).href,
      "Open creator dashboard ↗",
      "cta",
    ),
  );
  const expand = el(
    "button",
    {
      type: "button",
      class: "btn secondary",
      "aria-expanded": "false",
      "aria-controls": "creator-overview",
    },
    "Expand calls & wallet activity",
  );
  const overview = el("div", { id: "creator-overview" });
  overview.hidden = true;
  const toggle = () => {
    overview.hidden = !overview.hidden;
    host.dataset.expanded = String(!overview.hidden);
    expand.setAttribute("aria-expanded", String(!overview.hidden));
    expand.textContent = overview.hidden
      ? "Expand calls & wallet activity"
      : "Collapse";
    if (!overview.hidden)
      void renderOverview(
        handle,
        overview,
        () => host.isConnected && profileHandle() === handle,
      );
  };
  expand.addEventListener("click", toggle);
  card.append(expand, overview);
  root.append(card);
  anchor.after(host);
  if (expanded) toggle();
  const insights = await loadInsights(handle, null, null).catch(() => null);
  if (!host.isConnected || profileHandle() !== handle) return;
  details.replaceChildren();
  if (!insights) {
    details.append(
      el(
        "p",
        { class: "note" },
        "Creator evidence unavailable. No identity, stake or performance claim.",
      ),
    );
    return;
  }
  const evidence = insights.evidence;
  const row = (label: string, value: string) =>
    el("div", { class: "row" }, el("span", {}, label), el("span", {}, value));
  details.append(
    row(
      "Identity",
      evidence?.identity.status === "bound"
        ? `Recorded binding · ${shortAddress(evidence.identity.wallet ?? "")}`
        : "No binding evidence available",
    ),
    row(
      "Refundable stake",
      evidence?.stake.status === "active"
        ? `Active · ${evidence.stake.symbol ?? "token"}`
        : evidence?.stake.status === "withdrawal-pending"
          ? "Withdrawal pending"
          : evidence?.stake.status === "inactive"
            ? "Inactive"
            : "Unavailable",
    ),
    row(
      "Detected calls",
      insights.reputation.status === "ready"
        ? String(insights.reputation.trackedCalls)
        : "Unavailable",
    ),
    row(
      "Call score",
      insights.reputation.score === null
        ? "Pending evaluation"
        : String(insights.reputation.score),
    ),
    el(
      "p",
      { class: "note" },
      "Identity, stake and call performance are separate. Detected calls cover posts seen by extension users; they are not wallet returns.",
    ),
    el(
      "p",
      { class: "note" },
      `Checked ${new Date().toISOString()} · handle is a lookup hint, not a fresh ownership proof.`,
    ),
  );
}
