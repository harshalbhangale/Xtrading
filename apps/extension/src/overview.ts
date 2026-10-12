import { creatorOverviewSchema } from "@call-my-bluff/domain";
import { el, safeLink, send } from "./dom";
import { postActions, postAttachments } from "./drawer";

export async function renderOverview(
  handle: string,
  container: HTMLElement,
  current: () => boolean,
) {
  container.replaceChildren(
    el("p", { class: "note" }, "Loading ongoing calls and wallet evidence…"),
  );
  const raw = await send<unknown>({ type: "creator-overview", handle });
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
  container.append(el("h3", {}, "Ongoing registered calls"));
  if (value.callsStatus !== "ready")
    container.append(
      el(
        "p",
        { class: "note" },
        "No registered-call evidence available for this account.",
      ),
    );
  else if (!value.ongoingCalls.length)
    container.append(
      el(
        "p",
        { class: "note" },
        "No ongoing registered calls in the latest 50-call ledger.",
      ),
    );
  for (const call of value.ongoingCalls.slice(0, 5)) {
    container.append(
      el(
        "div",
        { class: "finding" },
        safeLink(
          call.sourceUrl,
          `${call.evidence.terms.assetId} ${call.evidence.terms.direction} · expires ${new Date(Number(call.evidence.terms.expiry) * 1000).toISOString()}`,
        ),
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
