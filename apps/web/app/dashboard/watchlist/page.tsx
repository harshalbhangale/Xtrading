import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { Watchlist } from "../../../components/dashboard/watchlist";

export const metadata: Metadata = { title: "Watchlist" };
export default function WatchlistPage() {
  return (
    <>
      <PageHeading
        title="Watchlist"
        description="Creator handles saved in this browser."
      />
      <Panel title="Saved handles">
        <Watchlist />
      </Panel>
    </>
  );
}
