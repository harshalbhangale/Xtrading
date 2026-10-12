"use client";

import { useState } from "react";

const states = {
  unknown: {
    title: "No public record yet",
    identity: "Identity not linked",
    stake: "Stake unavailable",
    description:
      "An unknown account gets an evidence link, without a verification claim.",
  },
  linked: {
    title: "Identity linked · preview",
    identity: "Ownership proof present",
    stake: "Active stake · preview",
    description:
      "These are illustrative labels, not a live creator record or a real stake.",
  },
  stale: {
    title: "Evidence needs a refresh",
    identity: "Identity proof · preview",
    stake: "Stake state stale",
    description:
      "A stale indexer must not continue displaying current stake eligibility.",
  },
} as const;

export function ExtensionPreview() {
  const [state, setState] = useState<keyof typeof states>("unknown");
  const active = states[state];
  return (
    <div className="extension-demo">
      <fieldset
        className="preview-selector"
        aria-label="Illustrative extension states"
      >
        {(
          [
            ["unknown", "Unknown"],
            ["linked", "Linked"],
            ["stale", "Stale"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={state === value}
            onClick={() => setState(value)}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <div className="social-preview">
        <div className="preview-watermark">ILLUSTRATIVE UI / NOT LIVE DATA</div>
        <div className="social-author">
          <span className="avatar-placeholder" aria-hidden="true">
            ◎
          </span>
          <div>
            <strong>A creator in your feed</strong>
            <span>@handle · example layout</span>
          </div>
          <span aria-hidden="true">𝕏</span>
        </div>
        <p className="social-post">
          A financial call appears in your feed.
          <br />
          The evidence should be one click away.
        </p>
        <div className="evidence-popover" aria-live="polite">
          <div className="popover-heading">
            <span>↗ TRADEPOST</span>
            <span className="status-badge">Preview</span>
          </div>
          <h3>{active.title}</h3>
          <div className="preview-signals">
            <span>{active.identity}</span>
            <span>{active.stake}</span>
          </div>
          <p>{active.description}</p>
          <div className="preview-trade">
            <span>Trade preparation</span>
            <button type="button" disabled>
              Buy
            </button>
            <button type="button" disabled>
              Sell
            </button>
          </div>
          <p className="small-note">
            Illustration. In the extension, Buy and Sell open a trade review
            here; your wallet approves every transaction.
          </p>
        </div>
      </div>
    </div>
  );
}
