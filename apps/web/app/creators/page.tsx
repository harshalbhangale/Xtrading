import type { Metadata } from "next";
import Link from "next/link";
import { CreatorSearch } from "../../components/creator-search";
import { PageHeading, Panel } from "../../components/dashboard/ui";
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
    <>
      <PageHeading
        title="Creators"
        description="Look up any X handle, or open a creator who has bound their account to a wallet."
      />
      <Panel title="Look up a handle">
        <CreatorSearch />
      </Panel>
      <Panel
        title="Bound accounts"
        description="Most recent bindings first. Binding proves account ownership, not skill."
        action={<span className="tag">Monad testnet</span>}
      >
        {handles === null ? (
          <div className="dashboard-empty">
            <h3>The registry is unavailable right now.</h3>
            <p>Handle lookup above still works.</p>
          </div>
        ) : records.length === 0 ? (
          <div className="dashboard-empty">
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
      </Panel>
    </>
  );
}
