import {
  type KolAssessment,
  type PublicCall,
  reputationTiers,
  tierName,
} from "@call-my-bluff/domain";

const txLink = (hash: string) => `https://testnet.monadvision.com/tx/${hash}`;
const percent = (bps: number) => `${bps / 100}%`;

export function TierBadge({ tier }: { tier: KolAssessment["tier"] }) {
  return (
    <span className={`tier-badge tier-${tier ?? "none"}`}>
      {tierName(tier) ?? "No tier yet"}
    </span>
  );
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="tier-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.floor(value / 100)}
    >
      <span style={{ width: `${Math.min(100, value / 100)}%` }} />
    </div>
  );
}

/** Current tier, fee share and the requirements left for the next tier. */
export function TierProgress({ assessment }: { assessment: KolAssessment }) {
  const { tier, earnedTier, demotedBy, next, feeBps } = assessment;
  return (
    <div className="tier-progress">
      <div className="tier-current">
        <TierBadge tier={tier} />
        <p>
          {tier
            ? `Earns ${percent(feeBps)} of every buy made from this creator's posts, paid straight to their wallet.`
            : `Verified rate: ${percent(feeBps)} of every buy made from your posts. Reach Xtrading Pro for 0.5%.`}
        </p>
        {demotedBy > 0 && (
          <p className="tier-demoted">
            Earned {tierName(earnedTier)}, demoted {demotedBy}{" "}
            {demotedBy === 1 ? "tier" : "tiers"} by red flags below.
          </p>
        )}
      </div>
      {next ? (
        <div className="tier-next">
          <div className="tier-next-heading">
            <strong>Next: {next.name}</strong>
            <span>{Math.floor(assessment.progressBps / 100)}%</span>
          </div>
          <Bar
            value={assessment.progressBps}
            label={`Progress to ${next.name}`}
          />
          <ul>
            {next.requirements.map((requirement) => (
              <li key={requirement.label} data-met={requirement.met}>
                <span>{requirement.met ? "✓" : "○"}</span>
                {requirement.label}
                <em>
                  {requirement.target === 1
                    ? requirement.met
                      ? "yes"
                      : "not yet"
                    : `${requirement.current} / ${requirement.target}`}
                </em>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="small-note">Top tier reached.</p>
      )}
    </div>
  );
}

/** Pro → Max → Ultra with the rules and fee share of each. */
export function TierLadder({ current }: { current: KolAssessment["tier"] }) {
  return (
    <ol className="tier-ladder">
      {reputationTiers.map((tier) => (
        <li key={tier.id} data-current={tier.id === current}>
          <TierBadge tier={tier.id} />
          <strong>{percent(tier.feeBps)} of each buy</strong>
          <span>
            ≥{tier.minScored} scored calls · ≥{tier.minHitBps / 100}% right
            {tier.positiveMedian === "all" && " · positive median return"}
            {tier.positiveMedian === "7d" && " · positive median at 7d"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Evidence-backed accountability flags, or an honest empty state with coverage. */
export function KolFlags({
  assessment,
  calls,
}: {
  assessment: KolAssessment;
  calls: PublicCall[];
}) {
  const byId = new Map(calls.map((call) => [call.id, call]));
  if (!assessment.flags.length)
    return (
      <div className="dashboard-empty">
        <h3>No red flags found.</h3>
        <p>
          Checked {calls.length} registered{" "}
          {calls.length === 1 ? "call" : "calls"};{" "}
          {assessment.availabilityChecked}{" "}
          {assessment.availabilityChecked === 1 ? "post has" : "posts have"}{" "}
          been re-checked on X. Absence of flags is not an endorsement.
        </p>
      </div>
    );
  return (
    <ul className="kol-flags">
      {assessment.flags.map((flag) => (
        <li key={flag.kind} data-severity={flag.severity}>
          <div>
            <span className="flag-severity">
              {flag.severity === "serious" ? "Red flag" : "Warning"}
            </span>
            <strong>{flag.title}</strong>
          </div>
          <p>{flag.detail}</p>
          {(flag.callIds.length > 0 || flag.transactions.length > 0) && (
            <p className="flag-evidence">
              {flag.callIds.slice(0, 6).map((id) => {
                const call = byId.get(id);
                return call ? (
                  <a
                    key={id}
                    href={call.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={call.evidence.post.text}
                  >
                    {call.evidence.terms.assetId}{" "}
                    {call.evidence.terms.direction} call ↗
                  </a>
                ) : null;
              })}
              {flag.transactions.slice(0, 6).map((hash) => (
                <a
                  key={hash}
                  href={txLink(hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  tx {hash.slice(0, 10)}… ↗
                </a>
              ))}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
