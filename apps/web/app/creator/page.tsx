import type { Metadata } from "next";
import { CreatorStatus } from "../../components/creator-status";
import { PageHeading, Panel } from "../../components/dashboard/ui";

export const metadata: Metadata = { title: "Creator studio" };

export default function CreatorPage() {
  return (
    <>
      <PageHeading
        title="Creator studio"
        description="Bind your X account, lock a refundable stake and build a record people can check."
      />
      <Panel title="Your setup">
        <CreatorStatus />
      </Panel>
    </>
  );
}
