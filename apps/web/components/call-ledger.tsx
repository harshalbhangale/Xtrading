import type { IndexedCallBond, PublicCall } from "@call-my-bluff/domain";
import type { ReactNode } from "react";
import { formatUnits } from "viem";
import { PostAvailabilityCheck } from "./post-availability";

export function price(value: string, decimals: number) {
  const [whole, fraction = ""] = formatUnits(BigInt(value), decimals).split(
    ".",
  );
  // Four significant digits below $1, cents otherwise.
  const keep = whole === "0" ? Math.max(fraction.search(/[1-9]/), 0) + 4 : 2;
  const trimmed = fraction.slice(0, keep).replace(/0+$/, "");
  return trimmed ? `$${whole}.${trimmed}` : `$${whole}`;
}
function percent(bps: string) {
  const value = BigInt(bps);
  const sign = value < 0n ? "−" : "+";
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}%`;
}
const date = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
const outcomes = {
  success: "Correct",
  failure: "Wrong",
  tie: "Flat",
} as const;

const bondOutcomes = {
  open: "awaiting Chainlink settlement",
  success: "Chainlink: correct",
  failure: "Chainlink: wrong · bond slashed",
  tie: "Chainlink: flat · bond returned",
  refunded: "refunded · no price settled",
} as const;
const usdc = (units: string) => formatUnits(BigInt(units), 6);
const txLink = (hash: string) => `https://testnet.monadvision.com/tx/${hash}`;

type BondIndex = {
  status: "indexed" | "unavailable" | "unconfigured";
  progressBlock: string | null;
};

export function CallSummary({
  calls,
  bonds,
}: {
  calls: PublicCall[];
  bonds?: BondIndex;
}) {
  const resolved = calls.filter((c) => c.evidence.outcome);
  const correct = resolved.filter((c) => c.evidence.outcome === "success");
  const bonded = calls.filter((c) => c.bond).length;
  return (
    <p className="small-note">
      {calls.length} registered · {resolved.length} resolved
      {resolved.length > 0 &&
        ` · ${correct.length} of ${resolved.length} correct`}{" "}
      · {calls.length - resolved.length} open. Creator-registered within 24h of
      posting; posts they did not register are not covered.
      {bonds?.status === "indexed" &&
        ` ${bonded} bonded onchain (Envio, block ${bonds.progressBlock}).`}
      {bonds?.status === "unavailable" &&
        " Onchain bond status is unavailable right now."}
    </p>
  );
}

/** Onchain bond and its Chainlink CRE settlement, as indexed. */
function BondLine({ bond }: { bond: IndexedCallBond }) {
  return (
    <p className={`bond-line bond-${bond.status}`}>
      <a
        href={txLink(bond.registeredTx)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Bonded {usdc(bond.bond)} mUSDC ↗
      </a>
      <br />
      {bond.settledTx ? (
        <a
          href={txLink(bond.settledTx)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {bondOutcomes[bond.status]}
          {bond.status === "success" &&
            bond.payout &&
            ` · paid ${usdc(bond.payout)}`}{" "}
          ↗
        </a>
      ) : (
        bondOutcomes[bond.status]
      )}
      {bond.entryPrice && bond.exitPrice && (
        <span className="muted">
          <br />
          {price(bond.entryPrice, 8)} → {price(bond.exitPrice, 8)}
        </span>
      )}
    </p>
  );
}

export function CallLedger({
  calls,
  action,
}: {
  calls: PublicCall[];
  /** Optional per-call control, e.g. the owner's bond action. */
  action?: (call: PublicCall) => ReactNode;
}) {
  if (calls.length === 0)
    return (
      <div className="dashboard-empty">
        <h3>No calls registered yet.</h3>
        <p>Calls appear here once this creator registers a post.</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="record-table call-table">
        <thead>
          <tr>
            <th scope="col">Post</th>
            <th scope="col">Call</th>
            <th scope="col">Entry</th>
            <th scope="col">Expiry</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => {
            const { terms, entry, exit, outcome, returnBps, post } =
              call.evidence;
            return (
              <tr key={call.id}>
                <td className="call-post">
                  <a
                    href={call.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {date(call.publishedAt)} ↗
                  </a>
                  <p>{post.text || "(no text)"}</p>
                  <p className="small-note">
                    Archived at registration · {date(call.registeredAt)}
                  </p>
                  <PostAvailabilityCheck callId={call.id} />
                </td>
                <td>
                  <strong>
                    {terms.assetId} {terms.direction === "up" ? "up" : "down"}
                  </strong>
                  <br />
                  <span className="muted">
                    {call.evidence.horizon}
                    {terms.targetBps !== "1" &&
                      `, ≥${percent(terms.targetBps).slice(1)}`}
                  </span>
                </td>
                <td>{price(entry.price, entry.priceDecimals)}</td>
                <td>
                  {exit
                    ? price(exit.price, exit.priceDecimals)
                    : date(new Date(Number(terms.expiry) * 1000).toISOString())}
                </td>
                <td>
                  {outcome ? (
                    <span className={`call-outcome call-${outcome}`}>
                      {outcomes[outcome]}
                      {returnBps && ` ${percent(returnBps)}`}
                    </span>
                  ) : (
                    <span className="status-badge">Open</span>
                  )}
                  {call.bond && <BondLine bond={call.bond} />}
                  {action?.(call)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
