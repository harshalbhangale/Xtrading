import {
  normalizeHandle,
  postSignalResponseSchema,
  tradeReviewPath,
} from "@call-my-bluff/domain";
import { appOrigin } from "./config";
import { el, safeLink, send, shadowHost } from "./dom";
import { openDrawer } from "./drawer";
import { observeFollowing } from "./follow-observer";
import { postImages } from "./post-media";
import { scanProfile } from "./profile";

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

async function addSignal(article: HTMLElement, handle: string, postId: string) {
  const textNode = article.querySelector<HTMLElement>(
    '[data-testid="tweetText"]',
  );
  const text = textNode?.innerText.trim();
  if (!textNode || !text || text.length > 2000) return;
  const raw = await send<unknown>({
    type: "classify-post",
    payload: { postId, handle, text, images: postImages(article, postId) },
  });
  const parsed = postSignalResponseSchema.safeParse(raw);
  const current = postIdentity(article);
  if (
    !parsed.success ||
    parsed.data.signal.postId !== postId ||
    parsed.data.signal.handle !== handle ||
    (!parsed.data.signal.isCall && !parsed.data.signal.tokenMention) ||
    !article.isConnected ||
    seen.get(article) !== `${handle}:${postId}` ||
    current?.handle !== handle ||
    current.postId !== postId ||
    textNode.innerText.trim() !== text
  )
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
        signal.isCall
          ? `${arrow} Call: ${signal.direction ?? "trade"} ${signal.asset ?? ""}`
          : "Token address shared · unverified",
      ),
      el("span", { class: "meta" }, routeText),
      el(
        "span",
        { class: "meta" },
        signal.source === "llm" ? "· AI-extracted" : "· rule-extracted",
      ),
      open,
      safeLink(`https://x.com/${handle}/status/${postId}`, "View post ↗"),
    ),
  );
  const bar = root.querySelector(".bar");
  for (const side of ["buy", "sell"] as const) {
    const path = tradeReviewPath(signal, route, side);
    const label =
      route.status === "available" && route.instrument === "perp"
        ? side === "buy"
          ? "Long"
          : "Short"
        : side === "buy"
          ? "Buy"
          : "Sell";
    bar?.append(
      path
        ? safeLink(
            new URL(path, appOrigin).href,
            `${label} · review ↗`,
            "btn secondary",
          )
        : el(
            "button",
            {
              type: "button",
              disabled: "",
              class: "btn secondary",
              title:
                route.status === "unavailable" ? route.reason : "Unavailable",
            },
            `${label} unavailable`,
          ),
    );
  }
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

let queued = false;
function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    scanPosts();
    void scanProfile();
    observeFollowing();
  });
}
new MutationObserver(schedule).observe(document.body, {
  childList: true,
  subtree: true,
});
schedule();

setInterval(() => {
  if (document.visibilityState === "visible") void scanProfile();
}, 60_000);

setInterval(observeFollowing, 3000);
