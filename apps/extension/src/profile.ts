import { normalizeHandle, publicCallLedgerSchema } from "@call-my-bluff/domain";
import { callStats, callsLine, formatUnits6 } from "./card-metrics";
import { appOrigin } from "./config";
import { addProfileBadge } from "./creator-badge";
import {
  el,
  metricLine as line,
  safeLink,
  send,
  shadowHost,
  shortAddress,
} from "./dom";
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
  const expand = el(
    "button",
    {
      type: "button",
      class: "card-toggle",
      "aria-expanded": "false",
      "aria-controls": "creator-overview",
    },
    "Show details",
  );
  const overview = el("div", {
    id: "creator-overview",
    class: "card-overview",
  });
  overview.hidden = true;
  const toggle = () => {
    overview.hidden = !overview.hidden;
    host.dataset.expanded = String(!overview.hidden);
    expand.setAttribute("aria-expanded", String(!overview.hidden));
    expand.textContent = overview.hidden ? "Show details" : "Hide details";
    if (!overview.hidden)
      void renderOverview(
        handle,
        overview,
        () => host.isConnected && profileHandle() === handle,
      );
  };
  expand.addEventListener("click", toggle);
  card.append(
    details,
    el(
      "div",
      { class: "card-actions" },
      safeLink(
        new URL(`/creators/${handle}`, appOrigin).href,
        "Open record ↗",
        "cta",
      ),
      expand,
    ),
    overview,
  );
  root.append(card);
  anchor.after(host);
  if (expanded) toggle();
  const insights = await loadInsights(handle, null, null).catch(() => null);
  if (!host.isConnected || profileHandle() !== handle) return;
  details.replaceChildren();
  if (!insights) {
    details.append(
      line("Calls", null, "service unavailable"),
      line("Said / did", null, "service unavailable"),
      line("Wallet", null, "service unavailable"),
      line("Stake", null, "service unavailable"),
      el(
        "p",
        { class: "note" },
        "Creator evidence unavailable. No identity, stake or performance claim.",
      ),
    );
    return;
  }
  const evidence = insights.evidence;
  const wallet =
    evidence?.identity.status === "bound"
      ? line(
          "Wallet",
          `Linked · ${shortAddress(evidence.identity.wallet ?? "")}`,
        )
      : line("Wallet", null, "no linked wallet");
  const stake = evidence?.stake;
  const stakeLine =
    stake?.status === "active" && stake.balance
      ? line(
          "Stake",
          `${formatUnits6(stake.balance)} ${stake.symbol ?? ""} staked`.trim(),
        )
      : stake?.status === "withdrawal-pending"
        ? line("Stake", "Withdrawal pending")
        : stake?.status === "inactive"
          ? line("Stake", null, "no active stake")
          : line("Stake", null, "chain or indexer data not current");
  const callsSlot = line("Calls", "…");
  const sayDidSlot = line("Said / did", "…");
  details.append(callsSlot, sayDidSlot, wallet, stakeLine);
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
  callsSlot.replaceWith(
    text
      ? line("Calls", text)
      : line(
          "Calls",
          null,
          ledger.success ? "no registered calls" : "call ledger unavailable",
        ),
  );
  sayDidSlot.replaceWith(checked);
}

/** Said versus did for the creator's latest classified call, from the Nansen wallet check. */
async function sayDid(handle: string, insights: Insights) {
  const label = "Said / did";
  const latest = insights.reputation.recent[0];
  if (!latest?.asset || !latest.direction)
    return line(label, null, "no classified call to check");
  const checked = await loadInsights(handle, latest.asset, latest.direction);
  const check = checked?.nansen;
  if (!check || check.mode === "unavailable" || check.verdict === "unavailable")
    return line(label, null, "Nansen unavailable");
  // Demo results are fixtures, never evidence.
  if (check.mode === "demo") return line(label, null, "Nansen in demo mode");
  if (check.verdict === "not-applicable")
    return line(label, null, `not applicable to ${latest.asset}`);
  if (check.verdict === "no-activity")
    return line(label, `No wallet activity in ${latest.asset}`);
  const row = line(
    label,
    check.verdict === "contradiction"
      ? `⚠ Wallet did the opposite of the latest ${latest.asset} call`
      : `Wallet matched the latest ${latest.asset} call`,
    "",
    check.verdict,
  );
  const tx = check.findings.find((finding) => finding.transactionHash);
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
