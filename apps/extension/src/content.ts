import {
  normalizeHandle,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import { appOrigin } from "./config";

function link(label: string, path: string) {
  const anchor = document.createElement("a");
  anchor.textContent = label;
  anchor.href = new URL(path, appOrigin).href;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  return anchor;
}
function scan() {
  for (const article of Array.from(
    document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]'),
  ).slice(0, 50)) {
    const postLink = Array.from(
      article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'),
    ).find((a) => a.querySelector("time"));
    if (!postLink) continue;
    const match = new URL(postLink.href).pathname.match(
      /^\/([^/]+)\/status\/([0-9]{1,30})\/?$/,
    );
    const handle = match?.[1] ? normalizeHandle(match[1]) : null,
      postId = match?.[2];
    if (!handle || !postId) continue;
    // X renders the article as a row. Keep evidence in the post's content column.
    const actions = article.querySelector<HTMLElement>('[role="group"]');
    let content = actions?.parentElement;
    while (content && content !== article && !content.contains(postLink)) {
      content = content.parentElement;
    }
    if (!content || content === article) continue;
    const key = `${handle}:${postId}`;
    const existing = article.querySelector<HTMLElement>(".cmb-evidence");
    if (existing?.dataset.key === key) continue;
    existing?.remove();
    const box = document.createElement("aside");
    box.className = "cmb-evidence";
    box.dataset.key = key;
    box.setAttribute("aria-label", "No More Bluff creator evidence");
    box.addEventListener("click", (event) => event.stopPropagation());
    const identity = document.createElement("span"),
      stake = document.createElement("span");
    identity.textContent = "Identity: unavailable";
    stake.textContent = "Stake: unavailable";
    const details = document.createElement("details"),
      summary = document.createElement("summary"),
      explanation = document.createElement("p");
    summary.textContent = "Evidence";
    explanation.textContent =
      "Loading evidence. Identity, stake and performance are separate signals.";
    details.append(
      summary,
      explanation,
      link("Open creator record ↗", `/creators/${handle}`),
    );
    box.append(identity, stake, details);
    for (const side of ["buy", "sell"]) {
      const params = new URLSearchParams({
        instrument: "spot",
        chainId: "10143",
        side,
        postId,
      });
      box.append(
        link(
          side === "buy" ? "Buy · Kuru ↗" : "Sell · Kuru ↗",
          `/dashboard/trade?${params}`,
        ),
      );
    }
    content.append(box);
    void chrome.runtime
      .sendMessage({ type: "creator-evidence", handle })
      .then((raw) => {
        if (!box.isConnected || box.dataset.key !== key) return;
        const parsed = publicCreatorEvidenceSchema.safeParse(raw);
        if (!parsed.success) {
          explanation.textContent =
            "Evidence unavailable. No identity or stake claim is made.";
          return;
        }
        const evidence = parsed.data;
        identity.textContent =
          evidence.identity.status === "bound"
            ? "Identity: binding recorded"
            : "Identity: unavailable";
        stake.textContent =
          evidence.stake.status === "active"
            ? `Stake: active (${evidence.stake.symbol})`
            : evidence.stake.status === "withdrawal-pending"
              ? "Stake: withdrawal pending"
              : evidence.stake.status === "inactive"
                ? "Stake: inactive"
                : "Stake: unavailable";
        const parts = [
          `Observed ${evidence.observedAt}.`,
          evidence.identity.status === "bound"
            ? `Stable X ID ${evidence.identity.xUserId}; wallet ${evidence.identity.wallet}; bound ${evidence.identity.linkedAt}. A handle is a lookup hint; this records the account binding at that time.`
            : "No binding found.",
          `Monad testnet 10143. Stake ${evidence.stake.status}; indexer ${evidence.stake.indexing?.status ?? "unavailable"}; block ${evidence.stake.indexing?.progressBlock ?? "unavailable"}.`,
          "Mock tokens have no monetary value. Indexed evidence is unfinalized. Performance and actual returns are unavailable. Buy/Sell opens a fixed MON/USDC market review; the post does not establish a token or a recommendation. Signing happens only in the app wallet.",
        ];
        explanation.textContent = parts.join(" ");
      })
      .catch(() => {
        explanation.textContent =
          "Evidence unavailable. Reload the page if the extension was updated.";
      });
  }
}
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    scan();
  });
}).observe(document.body, { childList: true, subtree: true });
setInterval(() => {
  for (const box of document.querySelectorAll(".cmb-evidence")) box.remove();
  scan();
}, 60000);
scan();
