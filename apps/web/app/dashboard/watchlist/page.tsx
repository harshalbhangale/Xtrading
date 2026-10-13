import type { Metadata } from "next";
import { BrowserFollowingControl } from "../../../components/browser-following-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { Watchlist } from "../../../components/dashboard/watchlist";

export const metadata: Metadata = { title: "Watchlist" };
export default function WatchlistPage() {
  return (
    <>
      <PageHeading
        title="Watchlist"
        description="Creator handles saved from X profiles with the Xtrading extension, or added here."
      />
      <Panel title="Following observed on X">
        <BrowserFollowingControl />
      </Panel>
      <Panel title="Saved handles">
        <Watchlist />
      </Panel>
    </>
  );
}
