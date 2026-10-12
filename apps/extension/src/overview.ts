import {
  creatorOverviewSchema,
  type PublicCall,
  postAvailabilitySchema,
  publicCallLedgerSchema,
} from "@call-my-bluff/domain";
import {
  byAssetDirection,
  formatBps,
  profitFactor,
  worstCall,
} from "./card-metrics";
import { appOrigin } from "./config";
import { el, type Metric, metricPanel, safeLink, send } from "./dom";
import { postActions, postAttachments } from "./drawer";

export async function renderOverview(
  handle: string,
  container: HTMLElement,
  current: () => boolean,
) {
  container.replaceChildren(
    el("p", { class: "note" }, "Loading ongoing calls and wallet evidence…"),
  );
  const [raw, ledgerRaw] = await Promise.all([
    send<unknown>({ type: "creator-overview", handle }),
    send<unknown>({ type: "creator-ledger", handle }),
  ]);
  if (!current() || !container.isConnected) return;
  const parsed = creatorOverviewSchema.safeParse(raw);
  container.replaceChildren();
  if (!parsed.success || parsed.data.handle !== handle) {
    container.append(
      el(
        "p",
        { class: "note" },
        "Call and wallet evidence unavailable. Try again later.",
      ),
    );
    return;
  }
  const value = parsed.data;
  const shown = value.detectedPosts.slice(0, 5);
  const checks = new Map<string, Promise<Reach>>();
  const check = (postId: string) => {
    let result = checks.get(postId);
    if (!result) {
      result = reachability(postId);
      checks.set(postId, result);
    }
    return result;
  };
  const ledger = publicCallLedgerSchema.safeParse(ledgerRaw);
  const panel = renderPerformance(
    container,
    handle,
    ledger.success ? ledger.data.calls : null,
    value.followerTrades,
    current,
    () => {
      const ids = new Set<string>(shown.map((item) => item.signal.postId));
      for (const call of (ledger.success ? ledger.data.calls : []).slice(0, 5))
        ids.add(call.postId);
      return [...ids]
        .slice(0, 8)
        .map((postId) => ({ postId, check: () => check(postId) }));
    },
  );
  if (value.detectedPostsStatus !== "ready")
    panel.set("detected", {
      label: "Detected posts",
      value: null,
      reason: "unavailable",
    });
  else if (!value.detectedPosts.length)
    panel.set("detected", {
      label: "Detected posts",
      value: null,
      reason: "none captured",
    });
  else container.append(el("h3", {}, "Detected on X · unscored"));
  for (const { signal, route } of shown) {
    const flag = el("p", { class: "note reach-flag" });
    flag.hidden = true;
    void check(signal.postId).then((reach) => {
      if (reach !== "gone" || !current() || !flag.isConnected) return;
      flag.textContent = "⚠ No longer publicly reachable";
      flag.hidden = false;
    });
    container.append(
      el(
        "div",
        { class: "finding" },
        el(
          "strong",
          {},
          `${signal.asset ?? "Token"} · ${signal.direction ?? "no direction"}`,
        ),
        flag,
        postAttachments(signal),
        postActions(signal, route),
      ),
    );
  }
  if (value.expiredUnresolved)
    panel.set("expired", {
      label: "Expired calls",
      group: "Calls",
      value: `${value.expiredUnresolved} awaiting result`,
    });
  const activity = value.activity;
  if (!activity || activity.status === "unavailable")
    panel.set("swaps", {
      label: "Kuru swaps",
      value: null,
      reason: "indexer unavailable",
    });
  else if (!activity.swaps.length)
    panel.set("swaps", {
      label: "Kuru swaps",
      value: null,
      reason:
        activity.status === "lagging" ? "none yet · index lagging" : "none yet",
    });
  else
    for (const [index, swap] of activity.swaps.slice(0, 5).entries())
      panel.set(`swap${index}`, {
        label: `${swap.side} ${swap.market}`,
        kind: "row",
        group: "Kuru swaps",
        value: safeLink(
          `https://testnet.monadvision.com/tx/${swap.transactionHash}`,
          `${swap.transactionHash.slice(0, 8)}… ↗`,
        ),
      });
}

type Reach = "available" | "gone" | "unknown";
/** Public reachability of one post. Not-publicly-available cannot prove deletion. */
function reachability(postId: string): Promise<Reach> {
  return send<unknown>({ type: "post-availability", postId }).then((raw) => {
    const status = postAvailabilitySchema.safeParse(raw).data?.status;
    return status === "available"
      ? "available"
      : status === "not-publicly-available"
        ? "gone"
        : "unknown";
  });
}

const callLabel = (call: PublicCall) =>
  `${call.evidence.terms.assetId} ${call.evidence.terms.direction === "up" ? "↑" : "↓"} ${call.evidence.horizon}`;

function renderPerformance(
  container: HTMLElement,
  handle: string,
  calls: PublicCall[] | null,
  trades: {
    status: string;
    recorded: number;
    submitted: number;
    posts: number;
  },
  current: () => boolean,
  postsToCheck: () => Array<{ postId: string; check: () => Promise<Reach> }>,
) {
  const panel = metricPanel();
  container.append(panel.root);
  const missing = calls === null ? "ledger unavailable" : "no scored calls";
  const none = (label: string, reason: string): Metric => ({
    label,
    value: null,
    reason,
  });
  const worst = calls ? worstCall(calls) : null;
  const factor = calls ? profitFactor(calls) : null;
  const groups = calls ? byAssetDirection(calls) : [];
  panel.set(
    "worst",
    worst
      ? {
          label: "Worst call",
          kind: "stat",
          tone: "bad",
          group: "Performance",
          value: safeLink(
            worst.sourceUrl,
            formatBps(Number(worst.evidence.returnBps)),
          ),
        }
      : none("Worst call", missing),
  );
  panel.set(
    "factor",
    factor !== null
      ? {
          label: "Profit factor",
          kind: "stat",
          group: "Performance",
          value: `${factor.toFixed(1)}×`,
        }
      : none("Profit factor", worst ? "no losses yet" : missing),
  );
  if (groups.length)
    for (const group of groups)
      panel.set(`asset:${group.asset}:${group.direction}`, {
        label: `${group.asset} ${group.direction}`,
        group: "Assets",
        value: `${group.asset} ${group.direction === "up" ? "↑" : "↓"} ${group.hits}/${group.scored} · ${formatBps(group.medianBps)}`,
      });
  else panel.set("assets", none("By asset", missing));

  const reachMetric = (
    value: Metric["value"],
    reason = "",
    tone?: Metric["tone"],
  ) =>
    panel.set("reach", {
      label: "Post reachability",
      group: "Posts",
      value,
      reason,
      tone,
    });
  const targets = postsToCheck();
  if (!targets.length) reachMetric(null, "none captured");
  else {
    reachMetric("Checking…");
    void Promise.all(
      targets.map(async (target) => ({
        postId: target.postId,
        reach: await target.check(),
      })),
    ).then((results) => {
      if (!current() || !container.isConnected) return;
      const known = results.filter((result) => result.reach !== "unknown");
      const gone = known.filter((result) => result.reach === "gone");
      if (!known.length) return reachMetric(null, "check unavailable");
      reachMetric(
        gone.length
          ? el(
              "span",
              {},
              `${gone.length}/${known.length} unreachable `,
              ...gone.flatMap((result, index) => [
                index ? " " : "",
                safeLink(
                  `https://x.com/${handle}/status/${result.postId}`,
                  `↗${result.postId.slice(-4)}`,
                ),
              ]),
            )
          : `${known.length}/${known.length} reachable`,
        "",
        gone.length ? "bad" : "good",
      );
    });
  }

  panel.set(
    "trades",
    trades.status === "ready" && trades.recorded
      ? {
          label: "Trades from posts",
          group: "Trades",
          value: `${trades.recorded} trades · ${trades.submitted} on-chain`,
        }
      : none(
          "Trades from posts",
          trades.status === "ready" ? "none recorded" : "log unavailable",
        ),
  );
  panel.set("pnl", none("Followers' PnL", "not computed"));

  const list = calls ?? [];
  if (!list.length)
    panel.set("calls", none("Registered calls", calls ? "none" : missing));
  for (const call of list.slice(0, 10)) {
    const { outcome, returnBps } = call.evidence;
    panel.set(`call:${call.id}`, {
      label: callLabel(call),
      kind: "row",
      group: "Calls",
      value: safeLink(
        call.sourceUrl,
        outcome
          ? `${outcome === "success" ? "✓" : outcome === "failure" ? "✗" : "="}${returnBps ? ` ${formatBps(Number(returnBps))}` : ""}`
          : "open",
      ),
    });
  }
  if (list.length > 10)
    container.append(
      safeLink(
        new URL(`/creators/${handle}`, appOrigin).href,
        `All ${list.length} calls ↗`,
      ),
    );
  return panel;
}
