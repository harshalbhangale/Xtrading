import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { Watchlist } from "../../../components/dashboard/watchlist";

export const metadata: Metadata = { title: "Watchlist" };
export default function WatchlistPage() {
  return (
    <>
      <PageHeading
        eyebrow="02 / Watchlist"
        title="Follow with intention."
        description="Keep a local list of creator handles, then inspect the record behind their calls."
      />
      <Panel
        title="Your saved handles"
        description="Saved in this browser. Account sync is not connected."
      >
        <Watchlist />
      </Panel>
    </>
  );
}
