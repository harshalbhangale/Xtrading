import { normalizeHandle } from "@call-my-bluff/domain";

// Development origin. Production builds must explicitly configure an HTTPS origin.
const appOrigin = "http://localhost:3000";

function addEvidenceLinks() {
  for (const article of document.querySelectorAll<HTMLElement>(
    'article[data-testid="tweet"]',
  )) {
    if (article.querySelector(".cmb-evidence-link")) continue;
    const postLink = Array.from(
      article.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'),
    ).find((link) => link.querySelector("time"));
    if (!postLink) continue;
    const match = new URL(postLink.href).pathname.match(
      /^\/([^/]+)\/status\/([0-9]+)/,
    );
    const handle = match?.[1] ? normalizeHandle(match[1]) : null;
    if (!handle) continue;
    const link = document.createElement("a");
    link.className = "cmb-evidence-link";
    link.href = `${appOrigin}/creators/${encodeURIComponent(handle)}`;
    link.textContent = "↗ View creator evidence";
    link.title = "Open No More Bluff. This link is not a verification badge.";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    article.append(link);
  }
}

let scanQueued = false;
new MutationObserver(() => {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    addEvidenceLinks();
  });
}).observe(document.body, { childList: true, subtree: true });
addEvidenceLinks();
