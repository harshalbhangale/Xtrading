import { CreatorPayoutControl } from "../../../components/creator-payout-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
export default function EarningsPage() {
  return (
    <>
      <PageHeading
        title="Creator earnings"
        description="Earn a disclosed fee when people buy from your posts. Account ownership and trading performance remain separate."
      />
      <Panel
        title="Payout registration"
        description="Link X and prove your wallet ownership. No World ID or staking required."
      >
        <CreatorPayoutControl />
      </Panel>
    </>
  );
}
