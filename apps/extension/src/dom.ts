import { css } from "./styles";

type Child = Node | string | null | undefined | false;

/** Build DOM without innerHTML; all strings become text nodes. */
export function el(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: Child[]
) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, value);
  for (const child of children)
    if (child)
      node.append(
        typeof child === "string" ? document.createTextNode(child) : child,
      );
  return node;
}

export function svg(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: Node[]
) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, value);
  node.append(...children);
  return node;
}

export function shadowHost(className: string) {
  const host = document.createElement("span");
  host.className = className;
  const background = getComputedStyle(document.body).backgroundColor;
  const channels = background.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const dark = channels
    ? Number(channels[1]) * 0.2126 +
        Number(channels[2]) * 0.7152 +
        Number(channels[3]) * 0.0722 <
      128
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  host.dataset.theme = dark ? "dark" : "light";
  const root = host.attachShadow({ mode: "open" });
  root.append(el("style", {}, css));
  return { host, root };
}

export function safeLink(href: string, label: string, className = "") {
  const url = new URL(href);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new Error("Invalid link");
  return el(
    "a",
    {
      href: url.href,
      target: "_blank",
      rel: "noopener noreferrer",
      class: className,
    },
    label,
  );
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Message the worker. After the extension reloads, the old content script keeps running in open
 * tabs and `chrome.runtime.sendMessage` throws "Extension context invalidated" synchronously, so
 * a promise `.catch` alone is not enough: treat a dead context as "no answer".
 */
export function send<T>(message: Record<string, unknown>): Promise<T | null> {
  try {
    if (!chrome.runtime?.id) return Promise.resolve(null);
    return chrome.runtime
      .sendMessage(message)
      .then((value: unknown) => {
        if (value && typeof value === "object" && "error" in value) return null;
        return value as T;
      })
      .catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/** One labelled metric. A missing value renders as "—" with the reason beside it. */
export function metricLine(
  label: string,
  value: string | Node | null,
  reason = "",
  tone = "",
) {
  return el(
    "div",
    {
      class: `metric${tone ? ` ${tone}` : ""}${value === null ? " empty" : ""}`,
    },
    label ? el("span", { class: "metric-label" }, label) : null,
    el(
      "span",
      { class: "metric-value" },
      value ?? "—",
      value === null && reason
        ? el("span", { class: "metric-reason" }, reason)
        : null,
    ),
  );
}
