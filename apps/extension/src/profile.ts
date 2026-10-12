import { normalizeHandle, publicCallLedgerSchema } from "@call-my-bluff/domain";
import { callStats, callsLine, formatUnits6 } from "./card-metrics";
import { appOrigin } from "./config";
import { addProfileBadge } from "./creator-badge";
import { el, safeLink, send, shadowHost, shortAddress } from "./dom";
import { type Insights, loadInsights } from "./drawer";
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
  void addProfileBadge(handle);
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
    el("div", { class: "title" }, "Xtrading · creator record"),
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
      "Open record ↗",
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
    "Calls, trades & wallet activity",
  );
  const overview = el("div", { id: "creator-overview" });
  overview.hidden = true;
  const toggle = () => {
    overview.hidden = !overview.hidden;
    host.dataset.expanded = String(!overview.hidden);
    expand.setAttribute("aria-expanded", String(!overview.hidden));
    expand.textContent = overview.hidden
      ? "Calls, trades & wallet activity"
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
  const line = (label: string, value: string, tone = "") =>
    el(
      "div",
      { class: `metric${tone ? ` ${tone}` : ""}` },
      el("span", { class: "metric-label" }, label),
      el("span", { class: "metric-value" }, value),
    );
  const slot = el("div", {});
  details.append(slot);
  const accountability = [
    evidence?.identity.status === "bound"
      ? `Wallet linked · ${shortAddress(evidence.identity.wallet ?? "")}`
      : null,
    evidence?.stake.status === "active" && evidence.stake.balance
      ? `${formatUnits6(evidence.stake.balance)} ${evidence.stake.symbol ?? ""} staked`.trim()
      : evidence?.stake.status === "withdrawal-pending"
        ? "stake withdrawing"
        : null,
  ].filter((part): part is string => part !== null);
  const [ledgerRaw, checked] = await Promise.all([
    send<unknown>({ type: "creator-ledger", handle }),
    sayDid(handle, insights),
  ]);
  if (!host.isConnected || profileHandle() !== handle) return;
  const ledger = publicCallLedgerSchema.safeParse(ledgerRaw);
  const text = callsLine(
    callStats(ledger.success ? ledger.data.calls : []),
    insights.reputation.status === "ready"
      ? insights.reputation.trackedCalls
      : 0,
  );
  slot.replaceChildren(
    ...[
      text ? line("Calls", text) : null,
      checked,
      accountability.length ? line("Record", accountability.join(" · ")) : null,
    ].filter((node): node is HTMLElement => node !== null),
  );
  if (!slot.childElementCount)
    slot.append(el("p", { class: "note" }, "No creator record yet."));
}

/**
 * Said versus did for the creator's latest classified call, from the Nansen wallet check.
 * Shown only for live provider data; demo, unavailable and no-activity results stay hidden.
 */
async function sayDid(handle: string, insights: Insights) {
  const latest = insights.reputation.recent[0];
  if (!latest?.asset || !latest.direction) return null;
  const checked = await loadInsights(handle, latest.asset, latest.direction);
  const check = checked?.nansen;
  if (!check || check.mode !== "live") return null;
  if (check.verdict !== "contradiction" && check.verdict !== "consistent")
    return null;
  const tx = check.findings.find((finding) => finding.transactionHash);
  const text =
    check.verdict === "contradiction"
      ? `⚠ Wallet did the opposite of the latest ${latest.asset} call`
      : `Wallet matched the latest ${latest.asset} call`;
  const row = el(
    "div",
    { class: `metric ${check.verdict}` },
    el("span", { class: "metric-label" }, "Said / did"),
    el("span", { class: "metric-value" }, text),
  );
  if (tx?.transactionHash && /^0x[0-9a-fA-F]{64}$/.test(tx.transactionHash))
    row
      .querySelector(".metric-value")
      ?.append(
        " ",
        safeLink(
          `https://testnet.monadvision.com/tx/${tx.transactionHash}`,
          "↗",
        ),
      );
  return row;
}
