"use client";

import Link from "next/link";
import { useId, useState } from "react";

const tiers = [
  {
    name: "Pro",
    share: "0.5%",
    mark: "Ⅰ",
    tagline: "Your first proven calls.",
    criteria: [
      "5 or more scored calls",
      "At least half of them right",
      "No serious red flags (each one costs a tier)",
    ],
    reward:
      "Earn 0.5% of every buy made from your post, paid to your wallet in the same transaction.",
  },
  {
    name: "Max",
    share: "1%",
    mark: "Ⅱ",
    tagline: "A record that holds up.",
    criteria: [
      "15 or more scored calls",
      "At least 60% right",
      "Positive median return across scored calls",
    ],
    reward:
      "Earn 1% of every buy made from your post, paid to your wallet in the same transaction.",
  },
  {
    name: "Ultra",
    share: "2%",
    mark: "Ⅲ",
    tagline: "Sustained, verifiable conviction.",
    criteria: [
      "30 or more scored calls",
      "At least 65% right",
      "Positive median return at the 7-day horizon",
    ],
    reward:
      "Earn 2% of every buy made from your post, paid to your wallet in the same transaction.",
  },
] as const;

export function CreatorProgram() {
  const [selected, setSelected] = useState(0);
  const panelId = useId();
  const tier = tiers[selected] ?? tiers[0];
  return (
    <section
      className="x-creator-program"
      id="creator-program"
      aria-label="Creator earnings and reputation"
    >
      <div className="x-flow-heading">
        <div>
          <p className="xp-eyebrow">
            FOR CREATORS / TURN CONVICTION INTO A RECORD
          </p>
          <h2>
            Own your calls.
            <br />
            <span>Grow your earnings.</span>
          </h2>
        </div>
        <p>
          Your post starts the trade.
          <br />
          Your reputation builds over time.
        </p>
      </div>
      <div className="x-creator-network">
        <div className="x-earn-flow" aria-hidden="true">
          <span>
            𝕏<small>YOUR POST</small>
          </span>
          <i>→</i>
          <span>
            ⇄<small>BUY FROM POST</small>
          </span>
          <i>→</i>
          <span>
            ↗<small>CREATOR CUT</small>
          </span>
        </div>
        <div>
          <p className="xp-eyebrow">POST → BUY → EARN</p>
          <h3>
            Your audience buys.
            <br />
            You earn a cut.
          </h3>
          <p>
            Every buy made from your post pays you a small cut, from 0.1% when
            verified up to 2% at Ultra. It lands in your wallet inside the same
            transaction and the buyer sees it before signing. No staking, no
            subscription, nothing to withdraw: link X, prove your wallet and
            climb the tiers.
          </p>
          <p className="x-program-note">
            Payout registration is available. Fee execution depends on
            deployment settings; authenticated post attribution remains pending.
            Earnings require confirmed payment evidence.
          </p>
          <Link href="/creator/earnings" className="xp-button">
            Set up creator payouts <span>↗</span>
          </Link>
        </div>
      </div>
      <div className="x-tier-header">
        <div>
          <p className="xp-eyebrow">EARNED, NOT BOUGHT / REPUTATION TIERS</p>
          <h3>Xtrading Pro. Max. Ultra.</h3>
        </div>
        <span className="x-roadmap-tag">EARNED FROM SCORED CALLS</span>
      </div>
      <p className="x-tier-intro">
        Tiers are achievements, not plans. Scored calls move you up; evidence of
        bad behaviour, like a deleted call or trading against your own call,
        moves you down. Your tier sets your cut of each buy from your posts:
        0.1% verified, 0.5% Pro, 1% Max, 2% Ultra. Live on Monad mainnet and
        testnet.
      </p>
      <fieldset className="x-tier-grid" aria-label="Explore creator tiers">
        {tiers.map((item, index) => (
          <button
            key={item.name}
            type="button"
            aria-pressed={selected === index}
            aria-controls={panelId}
            onClick={() => setSelected(index)}
          >
            <span className="x-tier-mark" aria-hidden="true">
              {item.mark}
              <i />
            </span>
            <small>XTRADING</small>
            <strong>{item.name}</strong>
            <em className="x-tier-price">{item.share} of each buy</em>
            <p>{item.tagline}</p>
            <span className="x-tier-open">
              Explore eligibility <b>↗</b>
            </span>
          </button>
        ))}
      </fieldset>
      <div id={panelId} className="x-tier-details">
        <div>
          <p className="xp-eyebrow">
            {tier.name.toUpperCase()} / HOW TO EARN IT
          </p>
          <h4>{tier.reward}</h4>
        </div>
        <ul>
          {tier.criteria.map((criterion) => (
            <li key={criterion}>
              <span aria-hidden="true">↗</span>
              {criterion}
            </li>
          ))}
        </ul>
      </div>
      <p className="x-program-note">
        A tier does not verify a person or promise profit; it summarises scored
        calls under the published methodology. Track your progress and earnings
        in the creator studio.
      </p>
      <div className="x-integrity-panel">
        <div className="x-post-trail" aria-hidden="true">
          <span className="x-trail-scan" />
          <p>ILLUSTRATIVE POST HISTORY</p>
          <div>
            <i />
            <b>01 / ORIGINAL POST</b>
            <span>Source + capture time</span>
          </div>
          <div>
            <i />
            <b>02 / FOLLOW-UP CHECK</b>
            <span>Unchanged / edited / unavailable</span>
          </div>
          <div>
            <i />
            <b>03 / CALL OUTCOME</b>
            <span>Result + supporting evidence</span>
          </div>
        </div>
        <div>
          <span className="x-roadmap-tag">
            MONITORING / LIVE FOR MISSING POSTS
          </span>
          <h3>
            A losing call shouldn’t
            <br />
            vanish from the record.
          </h3>
          <p>
            Registered call posts are archived at registration and re-checked on
            X. A call that disappears after going wrong is flagged and costs a
            tier, so cherry-picked winners don’t tell the whole story.
          </p>
          <div className="x-flow-tags">
            <span>Original snapshot</span>
            <span>Edit history</span>
            <span>Missing-post flags</span>
            <span>Outcome evidence</span>
          </div>
          <p className="x-program-note">
            Monitoring cannot prevent deletion on X. A flag needs two
            consecutive misses; failed lookups stay distinct, and deleted,
            protected or suspended posts look the same from outside. Edit
            history is not tracked yet.
          </p>
          <Link href="/creators?view=flagged" className="xp-text-link">
            See creators with red flags <span>↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
