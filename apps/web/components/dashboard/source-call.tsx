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
  const insights = await creatorInsights(handle, asset, direction).catch(
    () => null,
  );
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
        </dl>
      ) : (
        <p>Creator context is unavailable.</p>
      )}
    </Panel>
  );
}
