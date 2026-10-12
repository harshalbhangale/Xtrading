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

export function send<T>(message: Record<string, unknown>): Promise<T | null> {
  return chrome.runtime
    .sendMessage(message)
    .then((value: unknown) => {
      if (value && typeof value === "object" && "error" in value) return null;
      return value as T;
    })
    .catch(() => null);
}
