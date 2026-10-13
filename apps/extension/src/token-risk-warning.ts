import { el, safeLink, shadowHost } from "./dom";
import {
  matchTokenRiskReports,
  type TokenRiskMatch,
} from "./token-risk-reports";

export function tokenRiskWarning(matches: TokenRiskMatch[]) {
  const published = matches.every((m) => m.basis === "published-report");
  return el(
    "section",
    { class: "token-risk-warning", "aria-label": "Reported token risks" },
    el(
      "strong",
      { class: "token-risk-title" },
      published ? "! Token security report" : "! Reported token risk",
    ),
    ...matches.map(({ report, basis, networkConfirmedByText }) =>
      el(
        "div",
        { class: "token-risk-entry" },
        el("b", {}, `${report.token} · ${report.network}`),
        el("p", {}, report.finding),
        el("code", {}, report.address),
        basis === "address" && !networkConfirmedByText
          ? el(
              "p",
              { class: "token-risk-scope" },
              "Address matches a report on BNB Smart Chain; this post's network is not verified.",
            )
          : null,
        el(
          "div",
          { class: "token-risk-source" },
          `${report.publisher} · ${report.publishedAt} · `,
          safeLink(report.evidenceUrl, "View evidence ↗"),
        ),
      ),
    ),
    el(
      "p",
      { class: "token-risk-scope" },
      "Historical security report; current sell behaviour has not been simulated. These contracts are not supported by Xtrading's Monad markets.",
    ),
  );
}

/** Independent of classification/provider availability, including warnings with addresses in images. */
export function addTokenRiskWarning(
  article: HTMLElement,
  input: { text: string; handle: string; postId: string },
) {
  if (article.querySelector(".cmb-token-risk-host")) return;
  const textNode = article.querySelector('[data-testid="tweetText"]');
  if (!textNode) return;
  const matches = matchTokenRiskReports(input);
  if (!matches.length) return;
  const { host, root } = shadowHost("cmb-token-risk-host");
  host.dataset.postId = input.postId;
  root.append(tokenRiskWarning(matches));
  host.addEventListener("click", (event) => event.stopPropagation());
  textNode.after(host);
}
