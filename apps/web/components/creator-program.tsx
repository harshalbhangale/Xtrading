"use client";

import Link from "next/link";
import { useId, useState } from "react";

const tiers = [
  {
    name: "Pro",
    price: "10 USDC",
    mark: "Ⅰ",
    tagline: "Put your name on the record.",
    criteria: [
      "X account and payout wallet linked",
      "Public call history with source posts",
      "Proposed monthly price, not a stake",
    ],
    reward: "Proposed at 10 USDC a month on Monad. Billing is not live.",
  },
  {
    name: "Max",
    price: "20 USDC",
    mark: "Ⅱ",
    tagline: "A stronger public record.",
    criteria: [
      "Everything in Pro",
      "Evaluated calls with sample size and time window",
      "Wins, losses and unavailable posts stay visible",
    ],
    reward: "Proposed at 20 USDC a month on Monad after the record qualifies.",
  },
  {
    name: "Ultra",
    price: "30 USDC",
    mark: "Ⅲ",
    tagline: "The highest proposed plan.",
    criteria: [
      "Everything in Max",
      "Sustained results under published evaluation rules",
      "Resolved evidence disputes",
    ],
    reward: "Proposed at 30 USDC a month on Monad. Price follows the record.",
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
            ⇄<small>ELIGIBLE BUY</small>
          </span>
          <i>→</i>
          <span>
            ↗<small>CREATOR FEE</small>
          </span>
        </div>
        <div>
          <p className="xp-eyebrow">POST → BUY → EARN</p>
          <h3>
            Your audience trades.
            <br />
            You share in the fees.
          </h3>
          <p>
            Link your X account, verify wallet ownership and register a payout
            wallet. Eligible fee-enabled buys can pay a creator fee, disclosed
            to the buyer before wallet approval.
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
          <p className="xp-eyebrow">THE NEXT CHAPTER / REPUTATION TIERS</p>
          <h3>Xtrading Pro. Max. Ultra.</h3>
        </div>
        <span className="x-roadmap-tag">PROPOSED · NOT BILLED</span>
      </div>
      <p className="x-tier-intro">
        A creator subscription replaces a new stake. Pro, Max and Ultra are
        proposed at 10, 20 and 30 USDC a month on Monad. The price can rise only
        when the public record qualifies. This page does not submit a USDC
        transfer.
      </p>
      <fieldset
        className="x-tier-grid"
        aria-label="Explore proposed creator tiers"
      >
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
            <em className="x-tier-price">{item.price} / month proposed</em>
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
            {tier.name.toUpperCase()} / PROPOSED ELIGIBILITY
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
        These prices are a proposal. When billing is live, payment is USDC on
        Monad. A payment does not raise a score, verify an X account, or prove
        that followers made money. New stake deposits are closed. A previous
        deposit can still be withdrawn, and that balance stays separate from
        this subscription.
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
          <span className="x-roadmap-tag">MONITORING / PLANNED</span>
          <h3>
            A losing call shouldn’t
            <br />
            vanish from the record.
          </h3>
          <p>
            The planned post monitor keeps timestamped snapshots of registered
            source posts and checks for edits or disappearance. Post history
            sits beside evaluated call outcomes, so cherry-picked winners don’t
            tell the whole story.
          </p>
          <div className="x-flow-tags">
            <span>Original snapshot</span>
            <span>Edit history</span>
            <span>Missing-post flags</span>
            <span>Outcome evidence</span>
          </div>
          <p className="x-program-note">
            Monitoring cannot prevent deletion on X. An unavailable post is not
            proof of deletion or fraud; access failures stay distinct and flags
            require review. No live monitoring feed is connected here.
          </p>
          <Link href="/creators" className="xp-text-link">
            Explore existing creator records <span>↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
