import {
  normalizeHandle,
  postSignalResponseSchema,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import type { z } from "zod";
import { appOrigin } from "./config";
import { el, safeLink, send, shadowHost, shortAddress } from "./dom";
import { loadInsights, openDrawer } from "./drawer";

type Evidence = z.infer<typeof publicCreatorEvidenceSchema>;
const evidenceRequests = new Map<string, Promise<Evidence | null>>();

function evidence(handle: string) {
  let request = evidenceRequests.get(handle);
  if (!request) {
    if (evidenceRequests.size > 300) evidenceRequests.clear();
    request = send<unknown>({ type: "creator-evidence", handle }).then(
      (raw) => {
        const parsed = publicCreatorEvidenceSchema.safeParse(raw);
        return parsed.success ? parsed.data : null;
      },
    );
    evidenceRequests.set(handle, request);
    // Re-check after a minute so new bindings and stake changes appear.
    setTimeout(() => evidenceRequests.delete(handle), 60000);
  }
  return request;
}

function postIdentity(article: HTMLElement) {
  const postLink = Array.from(
    article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'),
  ).find((a) => a.querySelector("time"));
  if (!postLink) return null;
  const match = new URL(postLink.href).pathname.match(
    /^\/([^/]+)\/status\/([0-9]{1,30})\/?$/,
  );
  const handle = match?.[1] ? normalizeHandle(match[1]) : null;
  return handle && match?.[2] ? { handle, postId: match[2] } : null;
}

function badgeChips(value: Evidence | null) {
  const chips: HTMLElement[] = [];
  if (value?.identity.status === "bound")
    chips.push(
      el(
        "span",
        {
          class: "chip verified",
          title: "X account bound to a wallet with a signed proof",
        },
        "✓ Verified",
      ),
    );
  if (value?.stake.status === "active")
    chips.push(
      el(
        "span",
        {
          class: "chip staked",
          title: `Refundable ${value.stake.symbol ?? ""} stake active on Monad testnet`,
        },
        "◆ Staked",
      ),
    );
  return chips;
}

async function addBadge(article: HTMLElement, handle: string) {
  const name = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  if (!name || name.querySelector(".cmb-badge-host")) return;
  const { host, root } = shadowHost("cmb-badge-host");
  name.append(host);
  const chips = badgeChips(await evidence(handle));
  if (!chips.length) return host.remove();
  const badge = el("span", { class: "badge" }, ...chips);
  for (const chip of chips)
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(
        new URL(`/creators/${handle}`, appOrigin).href,
        "_blank",
        "noopener",
      );
    });
  root.append(badge);
}

async function addSignal(article: HTMLElement, handle: string, postId: string) {
  const textNode = article.querySelector<HTMLElement>(
    '[data-testid="tweetText"]',
  );
  const text = textNode?.innerText.trim();
  if (!textNode || !text || text.length > 2000) return;
  const raw = await send<unknown>({
    type: "classify-post",
    payload: { postId, handle, text },
  });
  const parsed = postSignalResponseSchema.safeParse(raw);
  if (!parsed.success || !parsed.data.signal.isCall || !article.isConnected)
    return;
  if (article.querySelector(".cmb-signal-host")) return;
  const { signal, route } = parsed.data;
  const { host, root } = shadowHost("cmb-signal-host");
  const arrow =
    signal.direction === "bullish"
      ? "📈"
      : signal.direction === "bearish"
        ? "📉"
        : "🎯";
  const open = el(
    "button",
    { class: "btn", type: "button" },
    route.status === "available" ? "Trade ▸" : "Details ▸",
  );
  open.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void openDrawer(postId, signal, route);
  });
  const routeText =
    route.status === "available"
      ? `${route.instrument === "perp" ? "Perp" : "Spot"} · ${route.venue}${route.side ? ` ${route.side}` : ""}`
      : "No testnet market";
  root.append(
    el(
      "div",
      { class: `bar${route.status === "available" ? "" : " unrouted"}` },
      el(
        "span",
        { class: "label" },
        `${arrow} Call: ${signal.direction ?? "trade"} ${signal.asset ?? ""}`,
      ),
      el("span", { class: "meta" }, routeText),
      el(
        "span",
        { class: "meta" },
        signal.source === "llm" ? "· AI-extracted" : "· rule-extracted",
      ),
      open,
    ),
  );
  // Clicks inside the bar must not open the post.
  host.addEventListener("click", (e) => e.stopPropagation());
  textNode.after(host);
}

const seen = new WeakMap<HTMLElement, string>();
const visible = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const article = entry.target as HTMLElement;
      visible.unobserve(article);
      const id = postIdentity(article);
      if (!id) continue;
      void addBadge(article, id.handle);
      void addSignal(article, id.handle, id.postId);
    }
  },
  { rootMargin: "200px" },
);

function scanPosts() {
  for (const article of document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]',
  )) {
    const id = postIdentity(article);
    if (!id) continue;
    const key = `${id.handle}:${id.postId}`;
    if (seen.get(article) === key) continue;
    // X recycles article nodes while scrolling; clear our UI when the post changes.
    seen.set(article, key);
    for (const stale of article.querySelectorAll(
      ".cmb-signal-host, .cmb-badge-host",
    ))
      stale.remove();
    visible.observe(article);
  }
}

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
  const [first, second] = location.pathname.split("/").filter(Boolean);
  if (!first || reserved.has(first.toLowerCase())) return null;
  if (
    second &&
    ![
      "with_replies",
      "media",
      "likes",
      "highlights",
      "articles",
      "superfollows",
    ].includes(second)
  )
    return null;
  return normalizeHandle(first);
}

async function scanProfile() {
  const handle = profileHandle();
  const existing = document.querySelector<HTMLElement>(".cmb-profile-host");
  if (existing && existing.dataset.handle !== handle) existing.remove();
  if (!handle || document.querySelector(".cmb-profile-host")) return;
  const anchor = document.querySelector<HTMLElement>(
    '[data-testid="primaryColumn"] [data-testid="UserName"]',
  );
  if (!anchor) return;
  const { host, root } = shadowHost("cmb-profile-host");
  host.dataset.handle = handle;
  host.style.display = "block";
  const card = el(
    "div",
    { class: "card" },
    el(
      "div",
      { class: "title" },
      "No More Bluff record",
      el("span", { class: "note" }, "loading…"),
    ),
  );
  root.append(card);
  anchor.after(host);
  const insights = await loadInsights(handle, null, null);
  if (!host.isConnected) return;
  card.replaceChildren();
  const ev = insights?.evidence;
  const bound = ev?.identity.status === "bound";
  const title = el(
    "div",
    { class: "title" },
    `@${handle}`,
    el("span", { class: "badge" }, ...badgeChips(ev ?? null)),
  );
  if (!insights) {
    card.append(
      title,
      el(
        "p",
        { class: "note" },
        "Record unavailable. Start the app or check the extension's app origin.",
      ),
    );
    return;
  }
  const rep = insights.reputation;
  const stat = (value: string, label: string) =>
    el("div", { class: "stat" }, el("b", {}, value), el("small", {}, label));
  card.append(
    title,
    el(
      "div",
      { class: "grid" },
      stat(
        bound ? "Verified" : "Unverified",
        bound ? shortAddress(ev?.identity.wallet ?? "") : "no wallet binding",
      ),
      stat(
        ev?.stake.status === "active"
          ? "Staked"
          : ev?.stake.status === "withdrawal-pending"
            ? "Exiting"
            : ev?.stake.status === "inactive"
              ? "No stake"
              : "—",
        "refundable stake",
      ),
      stat(
        String(rep.trackedCalls),
        `calls · ${rep.bullish}↑ ${rep.bearish}↓ ${rep.perpCalls} perp`,
      ),
    ),
    ...rep.recent
      .slice(0, 3)
      .map((call) =>
        el(
          "div",
          { class: "finding" },
          `${call.direction === "bearish" ? "📉" : call.direction === "bullish" ? "📈" : "🎯"} ${call.asset ?? ""} ${call.direction ?? ""} · ${call.instrument ?? ""} · ${call.classifiedAt.slice(0, 10)}`,
        ),
      ),
    el(
      "p",
      { class: "note" },
      "Score pending until calls can be evaluated against sourced prices. Identity, stake and calls are separate signals.",
    ),
    safeLink(
      new URL(`/creators/${handle}`, appOrigin).href,
      "Open full record ↗",
      "cta",
    ),
  );
}

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    scanPosts();
    void scanProfile();
  });
}
new MutationObserver(schedule).observe(document.body, {
  childList: true,
  subtree: true,
});
schedule();
