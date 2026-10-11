import type { Metadata } from "next";
import { CallFilters } from "../../../components/dashboard/call-filters";
import {
  ConnectionNote,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Your calls" };

export default function CallsPage() {
  return (
    <>
      <PageHeading
        title="Calls"
        description="Your predictions, their source posts and how each was evaluated."
      />
      <Panel title="Call ledger">
        <CallFilters />
      </Panel>
      <ConnectionNote>
        A call needs a source post, an asset, a direction and an expiry.
        Ambiguous posts stay unscored.
      </ConnectionNote>
    </>
  );
}
