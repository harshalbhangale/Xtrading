import { normalizeHandle } from "@call-my-bluff/domain";
import { send } from "./dom";

function handleFromLink(link: HTMLAnchorElement | null) {
  if (!link) return null;
  if (!["x.com", "twitter.com"].includes(new URL(link.href).hostname))
    return null;
  const match = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(new URL(link.href).pathname);
  return match?.[1] ? normalizeHandle(match[1]) : null;
}
function followState(container: Element, profile = false) {
  const unfollow = [
    ...container.querySelectorAll('[data-testid$="-unfollow"]'),
  ].find(
    (node) =>
      !node.closest('article[data-testid="tweet"]') &&
      (!profile || !node.closest('[data-testid="UserCell"]')),
  );
  if (unfollow) return true;
  const follow = [
    ...container.querySelectorAll('[data-testid$="-follow"]'),
  ].find(
    (node) =>
      !node.closest('article[data-testid="tweet"]') &&
      (!profile || !node.closest('[data-testid="UserCell"]')),
  );
  return follow ? false : null;
}
export function followObservations() {
  const viewer = handleFromLink(
    document.querySelector<HTMLAnchorElement>(
      'a[data-testid="AppTabBar_Profile_Link"]',
    ),
  );
  if (!viewer) return null;
  const [name, section, extra] = location.pathname.split("/").filter(Boolean);
  const owner = name ? normalizeHandle(name) : null;
  const observations: Array<{ handle: string; following: boolean }> = [];
  if (owner === viewer && section === "following" && !extra) {
    for (const cell of document.querySelectorAll(
      '[data-testid="primaryColumn"] [data-testid="UserCell"]',
    )) {
      const following = followState(cell);
      const handle = [...cell.querySelectorAll<HTMLAnchorElement>("a[href]")]
        .map((link) => handleFromLink(link))
        .find((value) => value && value !== viewer);
      if (handle && following !== null)
        observations.push({ handle, following });
    }
  } else if (
    owner &&
    (!section ||
      ["with_replies", "media", "likes", "highlights", "articles"].includes(
        section,
      ))
  ) {
    const column = document.querySelector('[data-testid="primaryColumn"]');
    if (column?.querySelector('[data-testid="UserName"]')) {
      const following = followState(column, true);
      if (following !== null) observations.push({ handle: owner, following });
    }
  }
  return { viewer, observations: observations.slice(0, 100) };
}
let lastScan = 0;
export function observeFollowing() {
  if (Date.now() - lastScan < 1500) return;
  lastScan = Date.now();
  const snapshot = followObservations();
  if (snapshot?.observations.length)
    void send({ type: "observe-following", ...snapshot });
}
