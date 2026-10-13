import { CreatorDashboardControl } from "../../../components/creator-dashboard";
import { CreatorPayoutControl } from "../../../components/creator-payout-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
export default function EarningsPage() {
  return (
    <>
      <PageHeading
        title="Earnings & posts"
        description="Your cut of every buy from your posts (0.1% verified, 0.5% Pro, 1% Max, 2% Ultra), paid straight to your wallet, and how each post performed."
      />
      <Panel title="Overview">
        <CreatorDashboardControl />
      </Panel>
      <Panel
        title="Payout wallet"
        description="Link X and prove your wallet ownership. No deposit, stake or subscription."
      >
        <CreatorPayoutControl />
      </Panel>
    </>
  );
}
