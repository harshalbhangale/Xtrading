import type { Metadata } from "next";
import Link from "next/link";
import { CreatorSearch } from "../../components/creator-search";
import { PageHeading, Panel } from "../../components/dashboard/ui";
import { TierBadge } from "../../components/kol-reputation";
import { kolRecord } from "../../lib/kol-record";
import {
  publicCreatorEvidence,
  recentBoundHandles,
} from "../../lib/public-creator";

export const metadata: Metadata = { title: "Creators" };
export const dynamic = "force-dynamic";

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const flaggedOnly = (await searchParams).view === "flagged";
  const handles = await recentBoundHandles();
  const all = handles
    ? await Promise.all(
        handles.map(async (handle) => {
          const [evidence, record] = await Promise.all([
            publicCreatorEvidence(handle),
            kolRecord(handle).catch(() => null),
          ]);
          return evidence ? { ...evidence, record } : null;
        }),
      )
    : [];
  const records = flaggedOnly
    ? all.filter((r) => r?.record?.assessment.flags.length)
    : all;
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
        description="Most recent bindings first. Tiers come from scored calls; red flags come from evidence and demote tiers."
        action={
          <nav className="preview-selector" aria-label="Filter creators">
            <Link
              href="/creators"
              aria-current={flaggedOnly ? undefined : "page"}
            >
              All
            </Link>
            <Link
              href="/creators?view=flagged"
              aria-current={flaggedOnly ? "page" : undefined}
            >
              Red flags
            </Link>
          </nav>
        }
      >
        {handles === null ? (
          <div className="dashboard-empty">
            <h3>The registry is unavailable right now.</h3>
            <p>Handle lookup above still works.</p>
          </div>
        ) : records.length === 0 && flaggedOnly ? (
          <div className="dashboard-empty">
            <h3>No bound creator has a red flag right now.</h3>
            <p>
              Flags appear when a registered post stops being public, a creator
              trades against their own call, most calls are wrong or a bond is
              slashed.
            </p>
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
                  <th scope="col">Tier</th>
                  <th scope="col">Record</th>
                  <th scope="col">Red flags</th>
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
                          <TierBadge
                            tier={record.record?.assessment.tier ?? null}
                          />
                        </td>
                        <td>
                          {record.record
                            ? record.record.assessment.scored
                              ? `${record.record.assessment.hits}/${record.record.assessment.scored} right · ${record.record.assessment.open} open`
                              : `${record.record.assessment.open} open · none scored`
                            : "Unavailable"}
                        </td>
                        <td>
                          {record.record?.assessment.flags.length ? (
                            <span className="flag-count">
                              {record.record.assessment.flags
                                .map((flag) => flag.title)
                                .join(" · ")}
                            </span>
                          ) : record.record ? (
                            "None found"
                          ) : (
                            "—"
                          )}
                        </td>
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
