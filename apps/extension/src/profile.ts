import {
  normalizeHandle,
  publicCallLedgerSchema,
  type Reputation,
  watchlistSchema,
} from "@call-my-bluff/domain";
import { callStats, formatBps, statTiles } from "./card-metrics";
import { appOrigin } from "./config";
import { addProfileBadge } from "./creator-badge";
import {
  el,
  type Metric,
  metricPanel,
  poweredBy,
  safeLink,
  send,
  shadowHost,
  shortAddress,
} from "./dom";
import { type Insights, loadInsights } from "./drawer";
import { renderOverview } from "./overview";
import { reputation, seriousFlags, tierLabel } from "./reputation";

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
      followButton(handle),
    ),
    overview,
  );
  card.append(poweredBy());
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
  const recent = recentCalls(handle, insights.reputation);
  if (recent) details.append(recent);
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
  const [ledgerRaw, checked, rep] = await Promise.all([
    send<unknown>({ type: "creator-ledger", handle }),
    sayDid(handle, insights),
    reputation(handle),
  ]);
  if (!host.isConnected || profileHandle() !== handle) return;
  panel.set(
    "tier",
    rep
      ? { label: "Tier", value: tierLabel(rep), kind: "row" }
      : { label: "Tier", value: null, reason: "unavailable" },
  );
  if (rep)
    panel.set("flags", {
      label: "Red flags",
      value: rep.assessment.flags.length
        ? rep.assessment.flags.map((f) => f.title).join(" · ")
        : "None found",
      kind: "row",
      ...(seriousFlags(rep).length ? { tone: "bad" as const } : {}),
    });
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
          ? "none registered"
          : "none yet",
    });
  detectedTiles(insights.reputation).forEach((tile, index) => {
    panel.set(`detected${index}`, {
      ...tile,
      kind: "stat",
      group: "Detected on X · priced from post time, unregistered",
    });
  });
  panel.set("saiddid", checked);
}

/**
 * Save or remove the creator in the extension's watchlist, which the dashboard reads.
 * Only the handle is stored; no X or wallet data is written.
 */
function followButton(handle: string) {
  const button = el(
    "button",
    {
      type: "button",
      class: "card-follow",
      "aria-pressed": "false",
    },
    "Watch",
  ) as HTMLButtonElement;
  let saved = false;
  const paint = (state: "saved" | "unsaved" | "unavailable") => {
    saved = state === "saved";
    button.disabled = state === "unavailable";
    button.setAttribute("aria-pressed", String(saved));
    button.textContent = saved
      ? "Watching"
      : state === "unavailable"
        ? "Unavailable"
        : "Watch";
    button.title =
      state === "saved"
        ? "On your Xtrading watchlist. Click to remove. This does not follow them on X."
        : state === "unsaved"
          ? "Save this handle to your Xtrading watchlist. This does not follow them on X."
          : "Reload the Xtrading extension to use the watchlist.";
  };
  const isSaved = (value: unknown) => {
    const parsed = watchlistSchema.safeParse(value);
    return parsed.success
      ? parsed.data.entries.some((entry) => entry.handle === handle)
      : null;
  };
  void send<unknown>({ type: "watchlist", action: "read" }).then((value) => {
    const listed = isSaved(value);
    if (listed === null) paint("unavailable");
    else paint(listed ? "saved" : "unsaved");
  });
  button.addEventListener("click", () => {
    button.disabled = true;
    void send<unknown>({
      type: "watchlist",
      action: saved ? "remove" : "add",
      handle,
    }).then((value) => {
      const listed = isSaved(value);
      if (listed === null) {
        button.disabled = false;
        button.title =
          "Could not update the watchlist. It may be full (50 handles) or the extension needs a reload.";
        return;
      }
      paint(listed ? "saved" : "unsaved");
    });
  });
  return button;
}

/** Counts from creator evidence seen by extension users. They are unverified and unscored. */
function detectedTiles(reputation: Reputation) {
  if (reputation.status !== "ready" || !reputation.trackedCalls) return [];
  const measured = reputation.measured;
  const tiles: { label: string; value: string; tone?: "good" | "bad" }[] = [
    { label: "Detected calls", value: String(reputation.trackedCalls) },
  ];
  if (measured?.count) {
    tiles.push({
      label: "Moved their way",
      value: `${measured.inFavour}/${measured.count}`,
      tone: measured.inFavour * 2 >= measured.count ? "good" : "bad",
    });
    if (measured.medianBps !== null)
      tiles.push({
        label: "Median since post",
        value: formatBps(measured.medianBps),
        tone: measured.medianBps >= 0 ? "good" : "bad",
      });
  }
  tiles.push(
    { label: "Bullish", value: String(reputation.bullish) },
    { label: "Bearish", value: String(reputation.bearish) },
  );
  return tiles;
}

/** The latest detected calls, shown as observations. Unclassified fields say so. */
function recentCalls(handle: string, reputation: Reputation) {
  if (reputation.status !== "ready" || !reputation.recent.length) return null;
  return el(
    "div",
    { class: "recent-calls" },
    el(
      "p",
      { class: "note" },
      "Detected from posts seen by Xtrading users. Unverified and unscored; no wallet claim.",
    ),
    el(
      "ul",
      {},
      ...reputation.recent.slice(0, 3).map((call) => {
        const posted = postTime(call.postId);
        return el(
          "li",
          {},
          [
            call.asset ?? "asset not classified",
            call.instrument ?? "instrument not classified",
            call.direction ?? "direction not classified",
          ].join(" · "),
          posted ? ` · ${ago(posted)} ` : " ",
          safeLink(`https://x.com/${handle}/status/${call.postId}`, "view ↗"),
        );
      }),
    ),
  );
}

/** Said versus did for the creator's latest classified call, from the Nansen wallet check. */
async function sayDid(handle: string, insights: Insights): Promise<Metric> {
  const label = "Wallet vs call";
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
