import { publicCreatorEvidenceSchema } from "@call-my-bluff/domain";
import type { z } from "zod";
import { verifiedBadge } from "./badge";
import { appOrigin } from "./config";
import { el, send, shadowHost } from "./dom";

type Evidence = z.infer<typeof publicCreatorEvidenceSchema>;
const rendered = new WeakMap<
  HTMLElement,
  { handle: string; expiresAt: number; request: object }
>();
function begin(name: HTMLElement, handle: string, className: string) {
  const previous = rendered.get(name);
  if (previous?.handle === handle && previous.expiresAt > Date.now())
    return null;
  const request = {};
  rendered.set(name, { handle, expiresAt: Date.now() + 60000, request });
  name.querySelector(`.${className}`)?.remove();
  return request;
}
function stillCurrent(name: HTMLElement, request: object) {
  return name.isConnected && rendered.get(name)?.request === request;
}
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

/** True when `node` sits in a left-to-right flow, so a following sibling stays on its line. */
function flowsHorizontally(node: HTMLElement) {
  const parent = node.parentElement;
  if (!parent) return false;
  const parentStyle = getComputedStyle(parent);
  if (parentStyle.display.includes("flex"))
    return !parentStyle.flexDirection.startsWith("column");
  if (parentStyle.display.includes("grid")) return false;
  return getComputedStyle(node).display.startsWith("inline");
}

/**
 * Place a badge on the display name's line, as high in the tree as possible.
 * X clips the name for truncation; a badge inside that box shows its glow as a square and
 * loses its tooltip. On post pages the name and @handle are stacked, so climbing too far puts
 * the badge on its own line. Pick the highest ancestor whose siblings still share its line.
 */
function insertAfterName(container: HTMLElement, host: HTMLElement) {
  const text = Array.from(container.querySelectorAll<HTMLElement>("span")).find(
    (span) => span.childElementCount === 0 && span.textContent?.trim(),
  );
  if (!text) return void container.append(host);
  const chain: HTMLElement[] = [];
  for (
    let node: HTMLElement | null = text;
    node && node !== container;
    node = node.parentElement
  )
    chain.push(node);
  const anchor = [...chain].reverse().find(flowsHorizontally) ?? text;
  anchor.after(host);
  return text;
}

/**
 * Centre the badge on the display name's line. When the anchor is a block holding both name
 * and @handle, the host's own centring would land between the two lines, so nudge it by the
 * measured offset (a relative shift never disturbs X's layout).
 */
function alignToName(host: HTMLElement, name: HTMLElement | undefined) {
  if (!name) return;
  const apply = () => {
    if (!host.isConnected || !name.isConnected) return;
    host.style.position = "relative";
    host.style.top = "0px";
    const target = name.getBoundingClientRect();
    const own = host.getBoundingClientRect();
    if (!own.height || !target.height) return;
    const delta = target.top + target.height / 2 - (own.top + own.height / 2);
    host.style.top = `${Math.round(delta * 2) / 2}px`;
  };
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 400);
}

function openRecord(handle: string) {
  return (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    window.open(
      new URL(`/creators/${handle}`, appOrigin).href,
      "_blank",
      "noopener",
    );
  };
}

/** Quiet badge beside the author name in a post: no tooltip, not a focus stop. */
export async function addPostBadge(article: HTMLElement, handle: string) {
  const name = article.querySelector<HTMLElement>('[data-testid="User-Name"]');
  if (!name) return;
  const request = begin(name, handle, "cmb-badge-host");
  if (!request) return;
  const value = await evidence(handle);
  if (!stillCurrent(name, request)) return;
  const { host, root } = shadowHost("cmb-badge-host");
  const chips: HTMLElement[] = [];
  if (value?.identity.status === "bound")
    chips.push(
      verifiedBadge({
        size: 20,
        title: "XTrading Verified",
        subtitle: "X identity linked · Wallet ownership verified",
        tooltip: false,
      }),
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
  if (!chips.length) return;
  for (const chip of chips) chip.addEventListener("click", openRecord(handle));
  root.append(el("span", { class: "badge" }, ...chips));
  alignToName(host, insertAfterName(name, host));
}

/** Badge beside the profile display name, with the explanatory tooltip. */
export async function addProfileBadge(handle: string | null) {
  const existing = document.querySelector<HTMLElement>(
    ".cmb-profile-badge-host",
  );
  if (!handle) return existing?.remove();
  const name = document.querySelector<HTMLElement>(
    '[data-testid="primaryColumn"] [data-testid="UserName"]',
  );
  if (!name) return;
  if (
    existing &&
    (existing.dataset.handle !== handle || !name.contains(existing))
  )
    existing.remove();
  const request = begin(name, handle, "cmb-profile-badge-host");
  if (!request) return;
  const value = await evidence(handle);
  if (!stillCurrent(name, request) || value?.identity.status !== "bound")
    return;
  const { host, root } = shadowHost("cmb-profile-badge-host");
  host.dataset.handle = handle;
  const badge = verifiedBadge({
    size: 24,
    title: "XTrading Verified",
    subtitle: "X identity linked · Wallet ownership verified",
  });
  badge.setAttribute("role", "link");
  badge.addEventListener("click", openRecord(handle));
  badge.addEventListener("keydown", (event) => {
    if (event.key === "Enter") openRecord(handle)(event);
  });
  root.append(badge);
  alignToName(host, insertAfterName(name, host));
}
