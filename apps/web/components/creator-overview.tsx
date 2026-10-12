"use client";
import {
  type CreatorOverview,
  creatorOverviewSchema,
} from "@call-my-bluff/domain";
import { useState } from "react";
export function CreatorOverviewPanel({ handle }: { handle: string }) {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<CreatorOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    setData(null);
    setError("");
    try {
      const response = await fetch(`/api/creators/${handle}/overview`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unavailable");
      const value = creatorOverviewSchema.parse(await response.json());
      if (value.handle !== handle) throw new Error("Mismatched creator");
      setData(value);
    } catch {
      setError("Call and wallet evidence unavailable. Try again later.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button"
        aria-expanded={expanded}
        aria-controls="creator-ongoing"
        onClick={() => {
          setExpanded(!expanded);
          if (!expanded) void load();
        }}
      >
        {expanded ? "Collapse" : "Expand calls & wallet activity"}
      </button>
      {expanded && (
        <div id="creator-ongoing" aria-live="polite">
          {busy && <p>Loading…</p>}
          {error && <p>{error}</p>}
          {data && (
            <>
              <h3>Ongoing registered calls</h3>
              <p className="small-note">
                Calls are predictions, not open trades. This view covers the
                latest 50 registered calls.
              </p>
              {data.callsStatus !== "ready" ? (
                <p>No registered-call evidence available.</p>
              ) : data.ongoingCalls.length === 0 ? (
                <p>No ongoing calls in this ledger.</p>
              ) : (
                <ul>
                  {data.ongoingCalls.map((call) => (
                    <li key={call.id}>
                      <a
                        href={call.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {call.evidence.terms.assetId}{" "}
                        {call.evidence.terms.direction} ↗
                      </a>{" "}
                      · expires{" "}
                      {new Date(
                        Number(call.evidence.terms.expiry) * 1000,
                      ).toISOString()}
                    </li>
                  ))}
                </ul>
              )}
              {data.expiredUnresolved > 0 && (
                <p>
                  {data.expiredUnresolved} expired calls awaiting resolution.
                </p>
              )}
              <h3>Recent confirmed Kuru swaps · Monad testnet</h3>
              {!data.activity || data.activity.status === "unavailable" ? (
                <p>Indexed wallet activity unavailable.</p>
              ) : (
                <>
                  <p className="small-note">
                    {data.activity.status} index · block{" "}
                    {data.activity.progressBlock} · unfinalized
                  </p>
                  {data.activity.swaps.length === 0 ? (
                    <p>No indexed swaps in this view.</p>
                  ) : (
                    <ul>
                      {data.activity.swaps.slice(0, 10).map((swap) => (
                        <li key={swap.id}>
                          <a
                            href={`https://testnet.monadvision.com/tx/${swap.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {swap.side} {swap.market} ·{" "}
                            {swap.transactionHash.slice(0, 10)}… ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <p className="small-note">{data.positionsNote}</p>
              <p className="small-note">Observed {data.observedAt}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
