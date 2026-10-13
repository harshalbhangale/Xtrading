import { normalizeHandle } from "@call-my-bluff/domain";
import { creatorInsights } from "../../lib/insights";
import { Panel } from "./ui";

const verdictLabel: Record<string, string> = {
  contradiction: "Contradiction observed",
  consistent: "Consistent with the call",
  "no-activity": "No matching activity",
  "not-applicable": "Not applicable",
  unavailable: "Unavailable",
};

const usd = (value: number) =>
  `${value < 0 ? "-" : ""}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;

/** Server-rendered context for the post a trade came from. Observations, not advice. */
export async function SourceCall({
  handle: rawHandle,
  postId,
  asset,
  direction,
}: {
  handle: string;
  postId: string;
  asset: string | null;
  direction: "bullish" | "bearish" | null;
}) {
  const handle = normalizeHandle(rawHandle);
  if (!handle || !/^[0-9]{1,30}$/.test(postId)) return null;
  const insights = await creatorInsights(
    handle,
    asset,
    direction,
    postId,
  ).catch(() => null);
  const nansen = insights?.nansen;
  return (
    <Panel
      title={`Source call · @${handle}`}
      description={`${direction ?? "Directionless"} ${asset ?? "asset"} call extracted from the post. Extraction is not a recommendation.`}
    >
      <p>
        <a
          className="text-link"
          href={`https://x.com/${handle}/status/${postId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open source post ↗
        </a>{" "}
        <a className="text-link" href={`/creators/${handle}`}>
          Creator record ↗
        </a>
      </p>
      {insights ? (
        <dl className="quote-review">
          <div>
            <dt>Identity</dt>
            <dd>
              {insights.evidence?.identity.status === "bound"
                ? `Bound wallet ${insights.evidence.identity.wallet}`
                : "No verified binding"}
            </dd>
          </div>
          <div>
            <dt>Tracked calls</dt>
            <dd>
              {insights.reputation.trackedCalls} ({insights.reputation.bullish}{" "}
              bullish · {insights.reputation.bearish} bearish ·{" "}
              {insights.reputation.perpCalls} perp) · score pending
            </dd>
          </div>
          <div>
            <dt>
              Nansen check{insights.nansen.mode === "demo" ? " (demo)" : ""}
            </dt>
            <dd>
              {verdictLabel[insights.nansen.verdict]}
              {insights.nansen.findings.map((f) => (
                <span key={`${f.summary}${f.transactionHash}`}>
                  <br />
                  {f.summary}
                </span>
              ))}
              <br />
              <small>{insights.nansen.note}</small>
            </dd>
          </div>
          {nansen?.token ? (
            <div>
              <dt>
                Token · {nansen.token.symbol ?? "unknown"} on{" "}
                {nansen.token.chain}
              </dt>
              <dd>
                {nansen.token.topHoldersPct === null
                  ? "Holder concentration unavailable"
                  : `Top 10 holders: ${nansen.token.topHoldersPct.toFixed(1)}% of supply`}
                {nansen.flags?.length ? (
                  nansen.flags.map((flag) => (
                    <span key={flag.kind}>
                      <br />
                      {flag.severity === "caution" ? "⚠ " : ""}
                      {flag.summary}
                    </span>
                  ))
                ) : (
                  <>
                    <br />
                    No token flags from the data returned.
                  </>
                )}
              </dd>
            </div>
          ) : null}
          {nansen?.walletPnl ? (
            <div>
              <dt>Wallet returns (90 days, all chains)</dt>
              <dd>
                {nansen.walletPnl.realizedUsd === null
                  ? "Realized PnL unavailable"
                  : `Realized PnL ${usd(nansen.walletPnl.realizedUsd)}`}
                {nansen.walletPnl.tradedTokens === null
                  ? ""
                  : ` · ${nansen.walletPnl.tradedTokens} tokens traded`}
                <br />
                <small>
                  Actual wallet returns, separate from call outcomes.
                </small>
              </dd>
            </div>
          ) : null}
          {nansen?.related?.length ? (
            <div>
              <dt>Possibly linked wallets</dt>
              <dd>
                {nansen.related.slice(0, 3).map((r) => (
                  <span key={r.address}>
                    {r.relation} · {r.label ?? r.address}
                    <br />
                  </span>
                ))}
                <small>A Nansen relation is not proof of control.</small>
              </dd>
            </div>
          ) : null}
          {nansen?.sources?.length ? (
            <div>
              <dt>Nansen requests</dt>
              <dd>
                <small>
                  {nansen.sources
                    .map(
                      (src) =>
                        `${src.endpoint}${src.chain ? ` (${src.chain})` : ""}: ${src.status}`,
                    )
                    .join(" · ")}
                </small>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p>Creator context is unavailable.</p>
      )}
    </Panel>
  );
}
