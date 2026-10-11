import type { Metadata } from "next";
import Link from "next/link";
import { CreatorSearch } from "../../components/creator-search";
import {
  publicCreatorEvidence,
  recentBoundHandles,
} from "../../lib/public-creator";
import { stakeLabel } from "../../lib/stake-label";

export const metadata: Metadata = { title: "Creators" };
export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const handles = await recentBoundHandles();
  const records = handles
    ? await Promise.all(handles.map((handle) => publicCreatorEvidence(handle)))
    : [];
  return (
    <div className="page subpage">
      <h1>Creators</h1>
      <p className="hero-copy">
        Look up any X handle, or open a creator who has bound their account.
      </p>
      <CreatorSearch />
      <div className="section-heading">
        <h2>Bound accounts</h2>
        <span className="tag">Monad testnet</span>
      </div>
      {handles === null ? (
        <div className="empty-state panel">
          <h3>The registry is unavailable right now.</h3>
          <p>Handle lookup above still works.</p>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state panel">
          <h3>No creator has bound an account yet.</h3>
          <p>
            Creators appear here after binding their X account to a wallet in
            the creator studio.
          </p>
          <Link className="text-link" href="/creator/profile">
            Bind your account ↗
          </Link>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="record-table">
            <thead>
              <tr>
                <th scope="col">Creator</th>
                <th scope="col">Identity</th>
                <th scope="col">Stake</th>
                <th scope="col">Bound</th>
              </tr>
            </thead>
            <tbody>
              {records.map(
                (record) =>
                  record && (
                    <tr key={record.handle}>
                      <td>
                        <Link href={`/creators/${record.handle}`}>
                          @{record.handle}
                        </Link>
                      </td>
                      <td>
                        {record.identity.status === "bound"
                          ? "Binding recorded"
                          : "Unavailable"}
                      </td>
                      <td>{stakeLabel(record.stake)}</td>
                      <td>
                        {record.identity.linkedAt
                          ? new Date(
                              record.identity.linkedAt,
                            ).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
