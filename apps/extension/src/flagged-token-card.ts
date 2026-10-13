import type { PostSignal } from "@call-my-bluff/domain";
import { el, safeLink } from "./dom";
import { loadInsights } from "./drawer";
import { nansenLink, riskVerdict } from "./risk-line";
import { logo, tokenIcon } from "./swap-card";

const short = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Swap-style card for a post that shares a token contract we cannot route.
 * The verdict is Nansen's live check of that contract; nothing can be bought
 * from here, and a risky result says so on the button.
 */
export function flaggedTokenCard(input: {
  postId: string;
  handle: string;
  signal: PostSignal;
}) {
  const reference = input.signal.tokenReferences.find((r) => r.kind === "evm");
  const symbol = (input.signal.asset ?? "TOKEN").toUpperCase();
  const card = el("section", {
    class: "inline-card swap-card flagged-card",
    "aria-label": `${symbol} contract check`,
  });
  const status = el(
    "p",
    { class: "flagged-status checking", role: "status" },
    el("span", { class: "flagged-mark", "aria-hidden": "true" }),
    el("span", {}, `Checking ${symbol} with Nansen…`),
  );
  const submit = el(
    "button",
    { type: "button", class: "inline-submit swap-submit", disabled: "" },
    "Checking…",
  );
  const box = (label: string, token: string) =>
    el(
      "div",
      { class: `swap-box${label === "You pay" ? " swap-pay" : ""}` },
      el("span", { class: "swap-label" }, label),
      el(
        "div",
        { class: "swap-line" },
        el("span", { class: "swap-out flagged-zero" }, "0"),
        el("span", { class: "swap-pill" }, tokenIcon(token, 24), token),
      ),
      el("span", { class: "swap-usd" }, "$0.00"),
    );
  const sides = el(
    "div",
    { class: "seg", role: "group", "aria-label": "Side" },
    el(
      "button",
      { type: "button", "aria-pressed": "true", disabled: "" },
      "Buy",
    ),
    el(
      "button",
      { type: "button", "aria-pressed": "false", disabled: "" },
      "Sell",
    ),
  );
  card.append(
    el(
      "div",
      { class: "inline-panel" },
      el("div", { class: "swap-row" }, sides),
      box("You pay", "USDC"),
      el("span", { class: "swap-arrow", "aria-hidden": "true" }, "↓"),
      box("You receive", symbol),
      el(
        "div",
        { class: "swap-row swap-meta" },
        el(
          "span",
          {},
          reference
            ? `Contract ${short(reference.address)}`
            : "Contract shared",
        ),
        el("span", {}, "No Monad market"),
      ),
      status,
      submit,
      el(
        "footer",
        { class: "swap-footer flagged-footer" },
        el("span", {}, "Powered by ", logo()),
      ),
    ),
  );

  void loadInsights(
    input.handle,
    input.signal.asset,
    input.signal.direction ?? null,
    input.postId,
  ).then((insights) => {
    const check = insights?.nansen ?? null;
    const verdict = riskVerdict(check);
    const link = nansenLink(check);
    status.className = `flagged-status ${verdict.tone}`;
    const detail = verdict.text.replace(/^Risky:\s*/, "");
    status.replaceChildren(
      el("span", { class: "flagged-mark", "aria-hidden": "true" }),
      el(
        "span",
        {},
        ...(verdict.tone === "risky"
          ? [el("b", {}, `Nansen flagged ${symbol}: `), detail]
          : [detail]),
      ),
      ...(link ? [safeLink(link, "Nansen ↗", "risk-link")] : []),
    );
    submit.textContent =
      verdict.tone === "risky"
        ? `${symbol} flagged as unsafe`
        : `${symbol} is not tradable on Monad`;
  });
  return card;
}
