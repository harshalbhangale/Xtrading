import type { Metadata } from "next";
import { CallFilters } from "../../../components/dashboard/call-filters";
import { PageHeading, Panel } from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Your calls" };

export default function CallsPage() {
  return (
    <>
      <PageHeading
        eyebrow="04 / Your calls"
        title="Keep the whole record."
        description="Explicit financial predictions, their original posts, and their evaluation status."
      />
      <Panel
        title="Call ledger"
        description="Collection coverage and excluded calls will be shown alongside scored results."
      >
        <CallFilters />
      </Panel>
      <div className="editorial-note">
        <h3>What makes a call eligible?</h3>
        <p>
          A source post, a clear asset and direction, a timestamp and an
          evaluable time horizon. Ambiguous posts stay unscored. The scoring
          methodology is still being defined; no historical accuracy is claimed
          here.
        </p>
      </div>
    </>
  );
}
