import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { MyReputation } from "../../../components/my-reputation";

export const metadata: Metadata = { title: "Reputation" };

export default function ReputationPage() {
  return (
    <>
      <PageHeading
        title="Reputation"
        description="Earn Xtrading Pro, Max and Ultra from scored calls. Your tier sets your share of buyers' realized profit; red flags demote. No staking required."
      />
      <Panel
        title="Your tier"
        description="Scored under the published methodology, with sample size beside every number."
      >
        <MyReputation full />
      </Panel>
    </>
  );
}
