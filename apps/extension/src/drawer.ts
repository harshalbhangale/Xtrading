import {
  type NansenCheck,
  nansenCheckSchema,
  type PostSignal,
  publicCreatorEvidenceSchema,
  type Reputation,
  reputationSchema,
  type TradeRoute,
} from "@call-my-bluff/domain";
import { z } from "zod";
import { appOrigin } from "./config";
import { el, safeLink, send, shadowHost, shortAddress } from "./dom";

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
) {
  if (route.status !== "available") return null;
  const params = new URLSearchParams({
    instrument: route.instrument,
    chainId: "10143",
    postId,
    handle: signal.handle,
  });
  if (route.side) params.set("side", route.side);
  if (signal.asset) params.set("asset", signal.asset);
  if (signal.direction) params.set("direction", signal.direction);
  if (route.venue === "Perpl") {
    params.set("marketId", route.marketId);
    if (signal.leverage)
      params.set("leverage", String(Math.min(signal.leverage, 50)));
  }
  return new URL(`/dashboard/trade?${params}`, appOrigin).href;
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
  const drawer = el(
    "aside",
    {
      class: "drawer",
      role: "dialog",
      "aria-label": "No More Bluff call details",
    },
    el("header", {}, el("strong", {}, `@${signal.handle} · call check`), close),
    body,
  );
  shell.root.append(drawer);
  document.body.append(shell.host);
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
  const trade = section(
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
  body.append(call, loading, trade);

  const insights = await loadInsights(
    signal.handle,
    signal.asset,
    signal.direction,
  );
  if (current !== shell) return;
  loading.replaceWith(
    insights
      ? el(
          "div",
          {},
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
