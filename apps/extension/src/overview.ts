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
import { el, metricLine, safeLink, send } from "./dom";
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
  const ledger = publicCallLedgerSchema.safeParse(ledgerRaw);
  renderPerformance(
    container,
    handle,
    ledger.success ? ledger.data.calls : null,
    value.followerTrades,
    current,
  );
  container.append(el("h3", {}, "Posts detected on X · not evaluated"));
  if (value.detectedPostsStatus !== "ready")
    container.append(el("p", { class: "note" }, "Detected posts unavailable."));
  else if (!value.detectedPosts.length)
    container.append(
      el(
        "p",
        { class: "note" },
        "No captured trade calls or token references yet.",
      ),
    );
  for (const { signal, route } of value.detectedPosts.slice(0, 5)) {
    container.append(
      el(
        "div",
        { class: "finding" },
        el(
          "strong",
          {},
          `${signal.asset ?? "Token reference"} · ${signal.direction ?? "No direction stated"}`,
        ),
        el("p", { class: "note" }, signal.summary),
        postAttachments(signal),
        postActions(signal, route),
        route.status === "unavailable"
          ? el("p", { class: "note" }, route.reason)
          : null,
      ),
    );
  }
  if (value.expiredUnresolved)
    container.append(
      el(
        "p",
        { class: "note" },
        `${value.expiredUnresolved} expired calls still awaiting resolution.`,
      ),
    );
  container.append(el("h3", {}, "Recent confirmed Kuru swaps · testnet"));
  if (!value.activity || value.activity.status === "unavailable")
    container.append(
      el("p", { class: "note" }, "Indexed wallet activity unavailable."),
    );
  else {
    container.append(
      el(
        "p",
        { class: "note" },
        `${value.activity.status} index · block ${value.activity.progressBlock ?? "unknown"} · unfinalized`,
      ),
    );
    if (!value.activity.swaps.length)
      container.append(
        el("p", { class: "note" }, "No indexed swaps in this view."),
      );
    for (const swap of value.activity.swaps.slice(0, 5))
      container.append(
        el(
          "div",
          { class: "finding" },
          safeLink(
            `https://testnet.monadvision.com/tx/${swap.transactionHash}`,
            `${swap.side} ${swap.market} · ${swap.transactionHash.slice(0, 10)}…`,
          ),
        ),
      );
  }
  container.append(
    el("p", { class: "note" }, value.positionsNote),
    el(
      "p",
      { class: "note" },
      `Observed ${value.observedAt}. Calls are predictions, not open trades or wallet returns.`,
    ),
  );
}

const callLabel = (call: PublicCall) =>
  `${call.evidence.terms.assetId} ${call.evidence.terms.direction} · ${call.evidence.horizon}`;

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
) {
  const missing =
    calls === null ? "call ledger unavailable" : "no scored calls";
  const worst = calls ? worstCall(calls) : null;
  const factor = calls ? profitFactor(calls) : null;
  const groups = calls ? byAssetDirection(calls) : [];
  container.append(
    el("h3", {}, "Performance"),
    metricLine(
      "Worst call",
      worst
        ? safeLink(
            worst.sourceUrl,
            `${callLabel(worst)} · ${formatBps(Number(worst.evidence.returnBps))}`,
          )
        : null,
      missing,
    ),
    metricLine(
      "Profit factor",
      factor !== null ? `${factor.toFixed(2)}× gains to losses` : null,
      worst ? "no losing calls yet" : missing,
    ),
    el("h3", {}, "By asset & direction"),
    ...(groups.length
      ? groups.map((group) =>
          metricLine(
            `${group.asset} ${group.direction}`,
            `${group.hits}/${group.scored} right · median ${formatBps(group.medianBps)}`,
          ),
        )
      : [metricLine("", null, missing)]),
  );

  const reach = metricLine("", "Checking…");
  container.append(el("h3", {}, "Deleted or unreachable posts"), reach);
  const recent = (calls ?? []).slice(0, 5);
  if (!recent.length)
    reach.replaceWith(
      metricLine("", null, calls ? "no registered calls" : missing),
    );
  else
    void Promise.all(
      recent.map((call) =>
        send<unknown>({ type: "call-availability", id: call.id }).then(
          (raw) => postAvailabilitySchema.safeParse(raw).data ?? null,
        ),
      ),
    ).then((results) => {
      if (!current() || !reach.isConnected) return;
      const checked = results.filter(
        (result) => result && result.status !== "unavailable",
      );
      const gone = checked.filter(
        (result) => result?.status === "not-publicly-available",
      ).length;
      reach.replaceWith(
        checked.length
          ? metricLine(
              "",
              `${gone} of ${checked.length} recent call posts not publicly reachable`,
              "",
              gone ? "contradiction" : "",
            )
          : metricLine("", null, "post check unavailable"),
      );
    });

  container.append(
    el("h3", {}, "Trades from this creator's posts"),
    trades.status === "ready" && trades.recorded
      ? metricLine(
          "Recorded trades",
          `${trades.recorded} trades on ${trades.posts} posts · ${trades.submitted} submitted on-chain`,
        )
      : metricLine(
          "Recorded trades",
          null,
          trades.status === "ready"
            ? "none recorded yet"
            : "trade log unavailable",
        ),
    metricLine("Followers' PnL", null, "not computed yet"),
    el("h3", {}, "All registered calls"),
  );
  if (!calls?.length)
    container.append(
      metricLine(
        "",
        null,
        missing === "no scored calls" ? "no registered calls" : missing,
      ),
    );
  for (const call of (calls ?? []).slice(0, 10)) {
    const { outcome, returnBps } = call.evidence;
    container.append(
      metricLine(
        new Date(call.publishedAt).toISOString().slice(0, 10),
        el(
          "span",
          {},
          safeLink(call.sourceUrl, callLabel(call)),
          ` · ${
            outcome
              ? `${outcome === "success" ? "right" : outcome === "failure" ? "wrong" : "tie"}${
                  returnBps ? ` ${formatBps(Number(returnBps))}` : ""
                }`
              : "open"
          }`,
        ),
      ),
    );
  }
  if ((calls?.length ?? 0) > 10)
    container.append(
      safeLink(
        new URL(`/creators/${handle}`, appOrigin).href,
        `All ${calls?.length} calls on the record ↗`,
      ),
    );
}
