import type { NansenCheck } from "@call-my-bluff/domain";
import { el, safeLink, shortAddress, svg } from "./dom";

type Finding = NansenCheck["findings"][number];

// Mainnet explorers for chains the Nansen wallet check reads. Perp fills have no link.
export const EXPLORERS: Record<string, string> = {
  monad: "https://monadvision.com",
  ethereum: "https://etherscan.io",
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
  bnb: "https://bscscan.com",
};

/** $1.74B, $16.0M, $93k, $472, -$1.2k. */
export function compactUsd(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const [n, unit] =
    abs >= 1e9
      ? [abs / 1e9, "B"]
      : abs >= 1e6
        ? [abs / 1e6, "M"]
        : abs >= 1e3
          ? [abs / 1e3, "k"]
          : [abs, ""];
  const digits = unit && n < 10 ? 2 : unit && n < 100 ? 1 : 0;
  return `${sign}$${n.toFixed(digits)}${unit}`;
}
const compactCount = (value: number) =>
  value >= 1e6
    ? `${(value / 1e6).toFixed(1)}M`
    : value >= 1e3
      ? `${(value / 1e3).toFixed(value >= 1e4 ? 0 : 1)}k`
      : String(value);
const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

function txLink(finding: Finding) {
  const explorer = EXPLORERS[finding.chain ?? ""];
  return explorer &&
    finding.transactionHash &&
    /^0x[0-9a-fA-F]{64}$/.test(finding.transactionHash)
    ? safeLink(`${explorer}/tx/${finding.transactionHash}`, "tx ↗", "nv-tx")
    : null;
}

function headline(check: NansenCheck) {
  const frontRun = check.findings.some((f) => f.kind === "front-run");
  switch (check.verdict) {
    case "contradiction":
      return frontRun
        ? ["Front-run pattern", "bad"]
        : ["Traded against the call", "bad"];
    case "consistent":
      return ["Traded with the call", "good"];
    case "no-activity":
      return ["No matching wallet trades", "neutral"];
    case "not-applicable":
      return ["No direction to compare", "neutral"];
    default:
      return ["Wallet check unavailable", "neutral"];
  }
}

function hero(check: NansenCheck) {
  const [title, tone] = headline(check);
  const cautions = (check.flags ?? []).filter((f) => f.severity === "caution");
  const glyph = tone === "bad" ? "!" : tone === "good" ? "✓" : "–";
  const scope = [
    check.wallet ? shortAddress(check.wallet) : "No bound wallet",
    check.chains?.length ? check.chains.join(" · ") : null,
    check.window ? `${day(check.window.from)} – ${day(check.window.to)}` : null,
  ].filter(Boolean);
  return el(
    "div",
    { class: `nv-hero ${tone}` },
    el("span", { class: "nv-glyph", "aria-hidden": "true" }, glyph),
    el(
      "div",
      { class: "nv-hero-text" },
      el("strong", {}, title),
      el("span", {}, scope.join("  ·  ")),
    ),
    cautions.length
      ? el(
          "span",
          { class: "nv-count" },
          `${cautions.length} caution${cautions.length > 1 ? "s" : ""}`,
        )
      : null,
  );
}

/** Wallet trades on a time axis around the post: with-call above the line, against below. */
function timeline(check: NansenCheck) {
  if (!check.window || !check.callAt) return null;
  const from = Date.parse(check.window.from);
  const to = Date.parse(check.window.to);
  const post = Date.parse(check.callAt);
  const points = check.findings.filter(
    (f) => f.observedAt && f.stance && f.kind !== "front-run",
  );
  if (!points.length || !(to > from)) return null;
  const W = 360;
  const left = 8;
  const right = W - 8;
  const x = (t: number) =>
    left +
    ((Math.min(Math.max(t, from), to) - from) / (to - from)) * (right - left);
  const maxUsd = Math.max(1, ...points.map((p) => Math.abs(p.valueUsd ?? 0)));
  const chart = svg(
    "svg",
    {
      viewBox: `0 0 ${W} 74`,
      class: "nv-timeline",
      role: "img",
      "aria-label": "Wallet trades before and after the post",
    },
    svg("rect", {
      x: "0",
      y: "6",
      width: String(W),
      height: "26",
      class: "nv-lane with",
    }),
    svg("rect", {
      x: "0",
      y: "34",
      width: String(W),
      height: "26",
      class: "nv-lane against",
    }),
    svg("line", {
      x1: String(left),
      x2: String(right),
      y1: "33",
      y2: "33",
      class: "nv-axis",
    }),
    svg("line", {
      x1: String(x(post)),
      x2: String(x(post)),
      y1: "2",
      y2: "62",
      class: "nv-post",
    }),
  );
  const label = (text: string, at: number, anchor: string, cls = "nv-tick") => {
    const node = svg("text", {
      x: String(at),
      y: "72",
      "text-anchor": anchor,
      class: cls,
    });
    node.textContent = text;
    chart.append(node);
  };
  label(day(check.window.from), left, "start");
  label("post", x(post), "middle", "nv-tick post");
  label(day(check.window.to), right, "end");
  for (const point of points) {
    const cx = x(Date.parse(point.observedAt as string));
    const cy = point.stance === "with" ? 19 : 47;
    // Area scales with value; unpriced trades get the minimum size.
    const r = 3.5 + 5.5 * Math.sqrt(Math.abs(point.valueUsd ?? 0) / maxUsd);
    const perp = point.kind === "perp-long" || point.kind === "perp-short";
    const mark = perp
      ? svg("rect", {
          x: String(cx - r),
          y: String(cy - r),
          width: String(r * 2),
          height: String(r * 2),
          transform: `rotate(45 ${cx} ${cy})`,
          class: `nv-dot ${point.stance}`,
        })
      : svg("circle", {
          cx: String(cx),
          cy: String(cy),
          r: String(r),
          class: `nv-dot ${point.stance}`,
        });
    const title = svg("title");
    title.textContent = point.summary;
    mark.append(title);
    chart.append(mark);
  }
  return el(
    "div",
    { class: "nv-block" },
    el(
      "div",
      { class: "nv-legend" },
      el("span", { class: "nv-key with" }, "With the call"),
      el("span", { class: "nv-key against" }, "Against the call"),
      el("span", { class: "nv-key perp" }, "Perp"),
    ),
    chart,
  );
}

function trades(check: NansenCheck) {
  const items = check.findings
    .filter((finding) => finding.kind !== "no-activity")
    .map((finding) => {
      if (finding.kind === "front-run")
        return el(
          "div",
          { class: "nv-callout" },
          el("strong", {}, "Bought before, sold after"),
          el("span", {}, finding.summary),
          txLink(finding),
        );
      return el(
        "div",
        { class: `nv-trade ${finding.stance ?? "neutral"}` },
        el("span", {}, finding.summary),
        txLink(finding),
      );
    });
  return items.length ? el("div", { class: "nv-list" }, ...items) : null;
}

function meter(pct: number) {
  const tone = pct >= 50 ? "bad" : pct >= 25 ? "warn" : "good";
  return el(
    "div",
    { class: "nv-meter-row" },
    el("span", { class: "nv-label" }, "Top 10 holders"),
    el(
      "div",
      { class: "nv-meter" },
      el("span", {
        class: `nv-fill ${tone}`,
        style: `width:${Math.max(2, Math.min(100, pct)).toFixed(1)}%`,
      }),
    ),
    el("b", { class: `nv-pct ${tone}` }, `${pct.toFixed(1)}%`),
  );
}

/** Diverging bars: net outflow to the left in red, net inflow to the right in green. */
function flows(token: NonNullable<NansenCheck["token"]>) {
  const f = token.flows;
  if (!f) return null;
  const rows: Array<[string, number | null]> = [
    ["Smart traders", f.smartTraderNetUsd],
    ["Whales", f.whaleNetUsd],
    ["Public figures", f.publicFigureNetUsd],
  ];
  // On wrapped majors these two are dominated by wrapping and CEX plumbing.
  if (token.origin === "post")
    rows.push(
      ["Fresh wallets", f.freshWalletsNetUsd],
      ["Exchanges", f.exchangeNetUsd],
    );
  const shown = rows.filter((row): row is [string, number] => row[1] !== null);
  if (!shown.length) return null;
  const max = Math.max(1, ...shown.map(([, v]) => Math.abs(v)));
  return el(
    "div",
    { class: "nv-block" },
    el("div", { class: "nv-sub" }, `Net flow · last ${f.timeframe}`),
    ...shown.map(([name, value]) => {
      const width = `${((Math.abs(value) / max) * 50).toFixed(1)}%`;
      const side = value < 0 ? "out" : "in";
      return el(
        "div",
        { class: "nv-flow" },
        el("span", { class: "nv-label" }, name),
        el(
          "div",
          { class: "nv-flow-track" },
          el("span", { class: "nv-flow-mid" }),
          value === 0
            ? null
            : el("span", {
                class: `nv-flow-bar ${side}`,
                style:
                  side === "out"
                    ? `right:50%;width:${width}`
                    : `left:50%;width:${width}`,
              }),
        ),
        el(
          "b",
          { class: `nv-flow-value ${value === 0 ? "" : side}` },
          value === 0 ? "$0" : `${value > 0 ? "+" : ""}${compactUsd(value)}`,
        ),
      );
    }),
  );
}

function tokenBlock(check: NansenCheck) {
  const token = check.token;
  if (!token) return null;
  const tiles: Array<[string, string]> = [];
  if (token.marketCapUsd !== null)
    tiles.push(["Market cap", compactUsd(token.marketCapUsd)]);
  if (token.liquidityUsd !== null)
    tiles.push(["Liquidity", compactUsd(token.liquidityUsd)]);
  if (token.holders !== null)
    tiles.push(["Holders", compactCount(token.holders)]);
  const sellers = token.sellersAfterCall;
  return el(
    "div",
    { class: "nv-group" },
    el(
      "div",
      { class: "nv-token-head" },
      el("span", { class: "nv-symbol" }, token.symbol ?? "Token"),
      token.name ? el("span", { class: "nv-name" }, token.name) : null,
      el("span", { class: "nv-chain" }, token.chain),
      el(
        "span",
        { class: "nv-origin" },
        token.origin === "post" ? "from post" : "reference token",
      ),
    ),
    tiles.length
      ? el(
          "div",
          { class: "nv-tiles" },
          ...tiles.map(([label, value]) =>
            el(
              "div",
              { class: "nv-tile" },
              el("b", {}, value),
              el("span", {}, label),
            ),
          ),
        )
      : null,
    token.topHoldersPct !== null ? meter(token.topHoldersPct) : null,
    flows(token),
    sellers.length
      ? el(
          "div",
          { class: "nv-block" },
          el(
            "div",
            { class: "nv-sub" },
            "Biggest sellers · 48h after the post",
          ),
          ...sellers.map((s) =>
            el(
              "div",
              {
                class: `nv-seller${s.isCreator || s.isLinked ? " flagged" : ""}`,
              },
              el(
                "span",
                { class: "nv-seller-name" },
                s.label || shortAddress(s.address),
                s.isCreator
                  ? el("i", { class: "nv-badge bad" }, "creator")
                  : null,
                s.isLinked
                  ? el("i", { class: "nv-badge warn" }, "linked")
                  : null,
              ),
              el("b", {}, `${compactUsd(s.soldUsd)} sold`),
            ),
          ),
        )
      : null,
  );
}

function flagsBlock(check: NansenCheck) {
  const flags = check.flags ?? [];
  if (!check.token && !flags.length) return null;
  if (!flags.length)
    return el(
      "p",
      { class: "nv-clear" },
      "No token flags from the data Nansen returned.",
    );
  const ordered = [...flags].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "caution" ? -1 : 1,
  );
  return el(
    "div",
    { class: "nv-list" },
    ...ordered.map((flag) =>
      el(
        "div",
        { class: `nv-flag ${flag.severity}` },
        el(
          "span",
          { class: "nv-flag-icon", "aria-hidden": "true" },
          flag.severity === "caution" ? "!" : "i",
        ),
        el("span", {}, flag.summary),
      ),
    ),
  );
}

function walletBlock(check: NansenCheck) {
  const pnl = check.walletPnl;
  const related = check.related ?? [];
  if (!pnl && !related.length) return null;
  const tiles: Node[] = [];
  if (pnl?.realizedUsd != null)
    tiles.push(
      el(
        "div",
        {
          class: `nv-tile ${pnl.realizedUsd > 0 ? "good" : pnl.realizedUsd < 0 ? "bad" : ""}`,
        },
        el("b", {}, compactUsd(pnl.realizedUsd)),
        el("span", {}, "Realized PnL · 90d"),
      ),
    );
  if (pnl?.tradedTokens != null)
    tiles.push(
      el(
        "div",
        { class: "nv-tile" },
        el("b", {}, String(pnl.tradedTokens)),
        el("span", {}, "Tokens traded"),
      ),
    );
  if (pnl?.onToken?.realizedUsd != null)
    tiles.push(
      el(
        "div",
        {
          class: `nv-tile ${pnl.onToken.realizedUsd > 0 ? "good" : pnl.onToken.realizedUsd < 0 ? "bad" : ""}`,
        },
        el("b", {}, compactUsd(pnl.onToken.realizedUsd)),
        el("span", {}, `PnL on ${check.token?.symbol ?? "token"}`),
      ),
    );
  return el(
    "div",
    { class: "nv-group" },
    el("div", { class: "nv-sub" }, "Creator wallet"),
    tiles.length ? el("div", { class: "nv-tiles" }, ...tiles) : null,
    related.length
      ? el(
          "div",
          { class: "nv-related" },
          ...related
            .slice(0, 4)
            .map((r) =>
              el(
                "span",
                { class: "nv-chip", title: r.address },
                el("i", {}, r.relation),
                r.label || shortAddress(r.address),
              ),
            ),
        )
      : null,
    el(
      "p",
      { class: "note" },
      related.length
        ? "Actual wallet returns, separate from the call. Related wallets are possible links, not proof of control."
        : "Actual wallet returns, separate from the call.",
    ),
  );
}

function sourcesBlock(check: NansenCheck) {
  const sources = check.sources ?? [];
  if (!sources.length) return null;
  const counts = new Map<string, number>();
  for (const s of sources)
    counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  const summary = [...counts]
    .map(([status, n]) => `${n} ${status}`)
    .join(" · ");
  return el(
    "details",
    { class: "nv-sources" },
    el(
      "summary",
      {},
      el("span", {}, `${sources.length} Nansen requests`),
      el("span", { class: "nv-sources-sum" }, summary),
    ),
    ...sources.map((s) =>
      el(
        "div",
        { class: "nv-source" },
        el("i", { class: `nv-status ${s.status}`, "aria-hidden": "true" }),
        el("code", {}, s.endpoint),
        el("span", {}, s.chain ?? ""),
        el("span", { class: "nv-source-status" }, s.note ?? s.status),
      ),
    ),
  );
}

/** The Nansen evidence for one call: wallet behaviour, token risk, returns, and every request made. */
export function nansenPanel(check: NansenCheck) {
  const heading = el("h3", {}, "Nansen check");
  heading.append(el("span", { class: "nv-net" }, "mainnet"));
  if (check.mode === "demo")
    heading.append(el("span", { class: "tag" }, "DEMO DATA"));
  return el(
    "div",
    { class: "section nansen" },
    heading,
    hero(check),
    timeline(check),
    trades(check),
    el("p", { class: "note" }, check.note),
    tokenBlock(check),
    flagsBlock(check),
    walletBlock(check),
    sourcesBlock(check),
  );
}
