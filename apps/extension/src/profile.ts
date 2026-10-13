import { normalizeHandle, publicCallLedgerSchema } from "@call-my-bluff/domain";
import { callStats, formatUnits6, statTiles } from "./card-metrics";
import { appOrigin } from "./config";
import { addProfileBadge } from "./creator-badge";
import {
  el,
  type Metric,
  metricPanel,
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

/** Below the bio and follower row, above Posts. Falls back to the name. */
function mountProfileCard(anchor: HTMLElement, host: HTMLElement) {
  const column =
    anchor.closest<HTMLElement>('[data-testid="primaryColumn"]') ??
    anchor.parentElement ??
    document.body;
  const tabs = column.querySelector<HTMLElement>('[role="tablist"]');
  if (tabs) {
    tabs.before(host);
    return;
  }
  const meta =
    column.querySelector<HTMLElement>(
      '[data-testid="UserProfileHeader_Items"]',
    ) ?? column.querySelector<HTMLElement>('[data-testid="UserDescription"]');
  if (meta) {
    meta.after(host);
    return;
  }
  anchor.after(host);
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
  host.style.width = "100%";
  const card = el(
    "div",
    { class: "card" },
    el("div", { class: "title" }, "Xtrading"),
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
  mountProfileCard(anchor, host);
  if (expanded) toggle();
  const insights = await loadInsights(handle, null, null).catch(() => null);
  if (!host.isConnected || profileHandle() !== handle) return;
  details.replaceChildren();
  const panel = metricPanel();
  details.append(panel.root);
  if (!insights) {
    panel.set("all", {
      label: "Creator record",
      value: null,
      reason: "service unavailable",
    });
    return;
  }
  const evidence = insights.evidence;
  panel.set(
    "wallet",
    evidence?.identity.status === "bound"
      ? {
          label: "Wallet linked",
          value: shortAddress(evidence.identity.wallet ?? ""),
        }
      : { label: "Wallet", value: null, reason: "not linked" },
  );
  const stake = evidence?.stake;
  panel.set(
    "stake",
    stake?.status === "active" && stake.balance
      ? {
          label: "Stake",
          value:
            `${formatUnits6(stake.balance)} ${stake.symbol ?? ""} staked`.trim(),
        }
      : stake?.status === "withdrawal-pending"
        ? { label: "Stake", value: "Withdrawing" }
        : {
            label: "Stake",
            value: null,
            reason:
              stake?.status === "inactive" ? "none" : "indexer not current",
          },
  );
  const [ledgerRaw, checked] = await Promise.all([
    send<unknown>({ type: "creator-ledger", handle }),
    sayDid(handle, insights),
  ]);
  if (!host.isConnected || profileHandle() !== handle) return;
  const ledger = publicCallLedgerSchema.safeParse(ledgerRaw);
  const tiles = statTiles(callStats(ledger.success ? ledger.data.calls : []));
  tiles.forEach((tile, index) => {
    panel.set(`tile${index}`, { ...tile, kind: "stat", group: "" });
  });
  if (!tiles.length)
    panel.set("calls", {
      label: "Calls",
      value: null,
      reason: !ledger.success
        ? "ledger unavailable"
        : insights.reputation.status === "ready" &&
            insights.reputation.trackedCalls
          ? `${insights.reputation.trackedCalls} detected, none scored`
          : "none yet",
    });
  panel.set("saiddid", checked);
}

/** Said versus did for the creator's latest classified call, from the Nansen wallet check. */
async function sayDid(handle: string, insights: Insights): Promise<Metric> {
  const label = "Said / did";
  const none = (reason: string): Metric => ({ label, value: null, reason });
  const latest = insights.reputation.recent[0];
  if (!latest?.asset || !latest.direction) return none("no directional call");
  const checked = await loadInsights(handle, latest.asset, latest.direction);
  const check = checked?.nansen;
  if (!check || check.mode === "unavailable" || check.verdict === "unavailable")
    return none("Nansen unavailable");
  // Demo results are fixtures, never evidence.
  if (check.mode === "demo") return none("Nansen demo mode");
  if (check.verdict === "not-applicable")
    return none(`n/a for ${latest.asset}`);
  // Which post was checked, when it was posted, and the wallet window Nansen read.
  const posted = postTime(latest.postId);
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  const context = el(
    "small",
    { class: "metric-sub" },
    `${latest.direction} ${latest.asset} post${posted ? ` · ${ago(posted)}` : ""} `,
    safeLink(`https://x.com/${handle}/status/${latest.postId}`, "view ↗"),
    check.window
      ? ` · ${check.chain} wallet, ${day(check.window.from)}–${day(check.window.to)}`
      : ` · ${check.chain} wallet`,
  );
  if (check.verdict === "no-activity")
    return {
      label,
      value: el(
        "span",
        {},
        `No ${latest.asset} trades by this wallet in 30 days`,
        context,
      ),
    };
  const bad = check.verdict === "contradiction";
  const text = bad
    ? `Wallet net ${latest.direction === "bullish" ? "sold" : "bought"} ${latest.asset} vs the call (30 days)`
    : `Wallet traded ${latest.asset} in line with the call (30 days)`;
  const tx = check.findings.find((finding) => finding.transactionHash);
  const explorer = /test/i.test(check.chain)
    ? "https://testnet.monadvision.com"
    : "https://monadvision.com";
  return {
    label,
    tone: bad ? "bad" : "good",
    value: el(
      "span",
      {},
      text,
      tx?.transactionHash && /^0x[0-9a-fA-F]{64}$/.test(tx.transactionHash)
        ? safeLink(`${explorer}/tx/${tx.transactionHash}`, " tx ↗")
        : null,
      context,
    ),
  };
}

/** Posting time from the X post ID (snowflake), so the age is the post's, not ours. */
function postTime(postId: string) {
  try {
    const ms = Number((BigInt(postId) >> 22n) + 1288834974657n);
    return ms > 1288834974657 && ms <= Date.now() + 60_000 ? ms : null;
  } catch {
    return null;
  }
}
function ago(ms: number) {
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
