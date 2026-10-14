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

const assetUrls = new Map<string, string>();

/** Old content scripts can outlive an extension reload; getURL then throws. */
export function assetUrl(path: string) {
  try {
    const url = globalThis.chrome?.runtime?.getURL?.(path);
    if (url) {
      assetUrls.set(path, url);
      return url;
    }
    return path;
  } catch {
    // Keep previously resolved assets; never request an extension path from X.
    return assetUrls.get(path) ?? "";
  }
}

export function poweredBy() {
  return el(
    "p",
    { class: "powered" },
    "Powered by ",
    el("img", {
      class: "powered-logo",
      src: assetUrl("brand/xtrading-wordmark.png"),
      alt: "Xtrading",
      width: "42",
      height: "14",
    }),
  );
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

export type Metric = {
  label: string;
  /** null = no data; it moves into the collapsed "No data" dropdown with `reason`. */
  value: string | Node | null;
  reason?: string;
  /** stat = big number tile, chip = compact pill (default), row = label and value line. */
  kind?: "stat" | "chip" | "row";
  tone?: "bad" | "good";
  group?: string;
};

/** Compact metrics: stat tiles, chips and rows. Empty ones collapse into one dropdown. */
export function metricPanel() {
  const root = el("div", { class: "metrics" });
  const entries = new Map<string, Metric>();
  let openState = false;
  const render = () => {
    const all = [...entries.values()];
    const missing = all.filter((m) => m.value === null);
    const groups = new Map<string, Metric[]>();
    for (const metric of all.filter((m) => m.value !== null))
      groups.set(metric.group ?? "", [
        ...(groups.get(metric.group ?? "") ?? []),
        metric,
      ]);
    root.replaceChildren();
    for (const [group, items] of groups) {
      const of = (kind: string) =>
        items.filter((m) => (m.kind ?? "chip") === kind);
      const stats = of("stat");
      const chips = of("chip");
      const rows = of("row");
      root.append(
        ...(group ? [el("div", { class: "metric-group" }, group)] : []),
        ...(stats.length
          ? [
              el(
                "div",
                { class: "stat-grid" },
                ...stats.map((m) =>
                  el(
                    "div",
                    { class: `stat-tile${m.tone ? ` ${m.tone}` : ""}` },
                    el("span", { class: "stat-value" }, m.value),
                    el("span", { class: "stat-label" }, m.label),
                  ),
                ),
              ),
            ]
          : []),
        ...(chips.length
          ? [
              el(
                "div",
                { class: "box-grid" },
                ...chips.map((m) => {
                  const long =
                    typeof m.value !== "string" || m.value.length > 20;
                  return el(
                    "div",
                    {
                      class: `metric-box${m.tone ? ` ${m.tone}` : ""}${long ? " wide" : ""}`,
                    },
                    el("span", { class: "metric-label" }, m.label),
                    el("span", { class: "metric-value" }, m.value),
                  );
                }),
              ),
            ]
          : []),
        ...rows.map((m) =>
          el(
            "div",
            { class: "metric-row" },
            el("span", { class: "metric-row-label" }, m.label),
            el("span", {}, m.value),
          ),
        ),
      );
    }
    if (missing.length) {
      const details = el(
        "details",
        { class: "unavailable" },
        el("summary", {}, `No data · ${missing.length}`),
        ...missing.map((m) =>
          el(
            "div",
            { class: "unavailable-row" },
            el("span", {}, m.label),
            el("span", {}, m.reason ?? "—"),
          ),
        ),
      );
      const disclosure = details as HTMLDetailsElement;
      disclosure.open = openState;
      disclosure.addEventListener("toggle", () => {
        openState = disclosure.open;
      });
      root.append(details);
    }
  };
  return {
    root,
    set(id: string, metric: Metric) {
      entries.set(id, metric);
      render();
    },
    remove(id: string) {
      entries.delete(id);
      render();
    },
  };
}
