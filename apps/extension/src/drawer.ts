import {
  type NansenCheck,
  nansenCheckSchema,
  type PostSignal,
  publicCreatorEvidenceSchema,
  type Reputation,
  reputationSchema,
  type TradeRoute,
  tradeReviewPath,
} from "@call-my-bluff/domain";
import { z } from "zod";
import { markPath } from "./badge";
import { appOrigin } from "./config";
import { el, safeLink, send, shadowHost, shortAddress, svg } from "./dom";
import { perpTicket } from "./perp-ticket";
import { spotTicket } from "./spot-ticket";

const insightsSchema = z.object({
  handle: z.string(),
  evidence: publicCreatorEvidenceSchema.nullable(),
  reputation: reputationSchema,
  nansen: nansenCheckSchema,
});
export type Insights = z.infer<typeof insightsSchema>;

export function loadInsights(
  handle: string,
  asset: string | null,
  direction: string | null,
) {
  return send<unknown>({
    type: "creator-insights",
    handle,
    asset,
    direction,
  }).then((raw) => {
    const parsed = insightsSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
}

export function tradeUrl(
  postId: string,
  signal: PostSignal,
  route: TradeRoute,
  chainId: 10143 | 143 = 10143,
) {
  const path = tradeReviewPath({ ...signal, postId }, route);
  if (!path) return null;
  const url = new URL(path, appOrigin);
  url.searchParams.set("chainId", String(chainId));
  return url.href;
}

export function postActions(signal: PostSignal, route: TradeRoute) {
  const result = el(
    "div",
    { class: "bar" },
    safeLink(
      `https://x.com/${signal.handle}/status/${signal.postId}`,
      "View post ↗",
    ),
  );
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
    result.append(
      path
        ? safeLink(new URL(path, appOrigin).href, `${label} · review ↗`, "btn")
        : el(
            "button",
            {
              type: "button",
              disabled: "",
              class: "btn",
              title:
                route.status === "unavailable" ? route.reason : "Unavailable",
            },
            `${label} unavailable`,
          ),
    );
  }
  return result;
}
export function postAttachments(signal: PostSignal) {
  const result = el("div", {});
  for (const ref of signal.tokenReferences)
    result.append(
      el(
        "p",
        { class: "note", style: "overflow-wrap:anywhere" },
        `${ref.kind === "solana" ? "Solana-shaped" : "EVM · chain unverified"} address: ${ref.address} · token identity unverified`,
      ),
    );
  for (const image of signal.images) {
    const link = safeLink(image.url, "", "");
    link.append(
      el("img", {
        src: image.url,
        alt: image.alt || "Post image",
        loading: "lazy",
        referrerpolicy: "no-referrer",
        style: "width:100%;max-height:240px;object-fit:contain",
      }),
    );
    result.append(link);
  }
  if (signal.images.length)
    result.append(
      el(
        "p",
        { class: "note" },
        "Browser-observed image. Read image text in the creator dashboard; attachments and image prices are not independently verified.",
      ),
    );
  return result;
}

const row = (label: string, value: string) =>
  el("div", { class: "row" }, el("span", {}, label), el("span", {}, value));
const section = (title: string, ...children: Array<Node | false | null>) =>
  el("div", { class: "section" }, el("h3", {}, title), ...children);

function nansenSection(check: NansenCheck) {
  const verdict: Record<NansenCheck["verdict"], [string, string]> = {
    contradiction: ["Contradiction observed", "contradiction"],
    consistent: ["Consistent with the call", "consistent"],
    "no-activity": ["No matching wallet activity", "neutral"],
    "not-applicable": ["Not applicable", "neutral"],
    unavailable: ["Unavailable", "neutral"],
  };
  const [label, tone] = verdict[check.verdict];
  const heading = el("div", {}, el("span", { class: `pill ${tone}` }, label));
  if (check.mode === "demo")
    heading.append(el("span", { class: "tag" }, "DEMO DATA"));
  return section(
    "Nansen wallet check",
    heading,
    ...check.findings.map((finding) =>
      el(
        "div",
        { class: "finding" },
        finding.summary,
        finding.observedAt
          ? el("div", { class: "note" }, finding.observedAt)
          : null,
      ),
    ),
    check.wallet ? row("Wallet", shortAddress(check.wallet)) : null,
    el("p", { class: "note" }, check.note),
  );
}

function reputationSection(reputation: Reputation, insights: Insights) {
  const evidence = insights.evidence;
  return section(
    "Creator",
    row(
      "Identity",
      evidence?.identity.status === "bound"
        ? `Verified · ${shortAddress(evidence.identity.wallet ?? "")}`
        : "No verified binding",
    ),
    row(
      "Refundable stake",
      evidence?.stake.status === "active"
        ? `Active (${evidence.stake.symbol})`
        : evidence?.stake.status === "withdrawal-pending"
          ? "Withdrawal pending"
          : evidence?.stake.status === "inactive"
            ? "Inactive"
            : "Unavailable",
    ),
    row("Tracked calls", String(reputation.trackedCalls)),
    row(
      "Bullish / bearish / perp",
      `${reputation.bullish} / ${reputation.bearish} / ${reputation.perpCalls}`,
    ),
    row(
      "Score",
      reputation.score === null
        ? "Pending — no evaluated calls"
        : String(reputation.score),
    ),
    el(
      "p",
      { class: "note" },
      "Identity, stake and call record are separate signals. A stake is not proof of good advice.",
    ),
  );
}

let current: { host: HTMLElement; root: ShadowRoot } | null = null;
let lastFocus: Element | null = null;

export function closeDrawer() {
  current?.host.remove();
  current = null;
  if (lastFocus instanceof HTMLElement) lastFocus.focus();
}

export async function openDrawer(
  postId: string,
  signal: PostSignal,
  route: TradeRoute,
) {
  closeDrawer();
  lastFocus = document.activeElement;
  const shell = shadowHost("cmb-drawer-host");
  current = shell;
  const close = el("button", { "aria-label": "Close" }, "×");
  close.addEventListener("click", closeDrawer);
  const body = el("div", {});
  const inlineRoot = document.querySelector(
    `.cmb-signal-host[data-post-id="${postId}"]`,
  )?.shadowRoot;
  const drawer = el(
    "aside",
    {
      class: inlineRoot ? "inline-panel" : "drawer",
      role: "dialog",
      "aria-label": "Xtrading call details",
    },
    el(
      "header",
      {},
      el(
        "div",
        { class: "brand" },
        el(
          "span",
          { class: "brand-mark", "aria-hidden": "true" },
          svg(
            "svg",
            { viewBox: "0 0 100 100" },
            svg("path", { fill: "currentColor", d: markPath }),
          ),
        ),
        el(
          "div",
          {},
          el("strong", {}, "Xtrading"),
          el("small", {}, `@${signal.handle} · call check`),
        ),
      ),
      close,
    ),
    body,
  );
  shell.root.append(drawer);
  if (inlineRoot) inlineRoot.append(shell.host);
  else document.body.append(shell.host);
  close.focus();
  drawer.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Escape") closeDrawer();
  });

  const direction = signal.direction
    ? el("span", { class: `dir-${signal.direction}` }, signal.direction)
    : el("span", {}, "no direction stated");
  const call = section(
    "What the post says",
    el(
      "div",
      {},
      el("strong", {}, signal.asset ?? "—"),
      " · ",
      direction,
      " · ",
      signal.instrument ?? "—",
      signal.leverage ? ` · ${signal.leverage}x` : "",
    ),
    el("p", { class: "note" }, signal.summary),
    row("Horizon", signal.horizon ?? "Not stated"),
    row("Confidence", signal.confidence),
    postAttachments(signal),
    safeLink(
      `https://x.com/${signal.handle}/status/${signal.postId}`,
      "View post ↗",
    ),
    row(
      "Extracted by",
      signal.source === "llm"
        ? `Groq (${signal.model ?? "model"})`
        : "Rules (no LLM key)",
    ),
  );
  if (signal.source === "heuristic")
    call.querySelector("h3")?.append(el("span", { class: "tag" }, "RULES"));
  const href = tradeUrl(postId, signal, route);
  const trade =
    route.status === "available" && route.instrument === "perp"
      ? section("Trade · Perpl perp", perpTicket(postId, signal, route))
      : route.status === "available" && route.venue === "Kuru"
        ? section("Trade · Kuru spot", spotTicket(postId, signal, route))
        : section(
            "Trade",
            route.status === "available"
              ? el(
                  "div",
                  {},
                  row("Venue", `${route.venue} · ${route.instrument}`),
                  row("Market", route.market),
                  row("Side", route.side ?? "Choose in review"),
                  el("p", { class: "note" }, route.note),
                )
              : el("p", {}, route.reason),
            href
              ? safeLink(
                  href,
                  `Review ${route.status === "available" ? route.venue : ""} trade in app ↗`,
                  "cta",
                )
              : el("span", { class: "cta disabled" }, "No testnet market"),
            postActions(signal, route),
            el(
              "p",
              { class: "note" },
              "Amounts, slippage and leverage are set in the app. Signing happens only in your app wallet. Not financial advice.",
            ),
          );
  const loading = el(
    "div",
    { class: "section" },
    el("p", { class: "note" }, "Loading creator record and Nansen check…"),
  );
  const network = el("div", { class: "section network" });
  const choices = el("div", {
    class: "network-switch",
    role: "group",
    "aria-label": "Trading network",
  });
  const note = el("p", { class: "note" });
  const buttons: HTMLElement[] = [];
  for (const [chainId, label] of [
    [10143, "Testnet"],
    [143, "Mainnet"],
  ] as const) {
    const button = el(
      "button",
      {
        type: "button",
        class: "seg",
        "aria-pressed": String(chainId === 10143),
      },
      label,
    );
    button.addEventListener("click", () => {
      for (const item of buttons)
        item.setAttribute("aria-pressed", String(item === button));
      trade.hidden = chainId === 143;
      note.textContent =
        chainId === 143
          ? "Monad mainnet · real funds. Execution is not ready; no testnet fallback."
          : "Monad testnet · test tokens only. Signing happens in your app wallet.";
      network.querySelector("a")?.remove();
      if (chainId === 143)
        network.append(
          safeLink(
            new URL("/dashboard/trade?chainId=143", appOrigin).href,
            "View mainnet status ↗",
          ),
        );
    });
    buttons.push(button);
    choices.append(button);
  }
  note.textContent =
    "Monad testnet · test tokens only. Signing happens in your app wallet.";
  network.append(choices, note);
  body.append(network, trade, call, loading);

  const insights = await loadInsights(
    signal.handle,
    signal.asset,
    signal.direction,
  );
  if (current !== shell) return;
  loading.replaceWith(
    insights
      ? el(
          "details",
          { class: "evidence-details" },
          el("summary", {}, "Creator record and Nansen evidence"),
          reputationSection(insights.reputation, insights),
          nansenSection(insights.nansen),
        )
      : section(
          "Creator",
          el(
            "p",
            { class: "note" },
            "Creator record unavailable. Is the app running?",
          ),
        ),
  );
  body.append(
    section(
      "Record",
      safeLink(
        new URL(`/creators/${signal.handle}`, appOrigin).href,
        "Open full creator record ↗",
      ),
    ),
  );
}
