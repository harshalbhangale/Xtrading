import type { Metadata } from "next";
import { CallsControl } from "../../../components/calls-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Calls" };

export default function CallsPage() {
  return (
    <>
      <PageHeading
        title="Calls"
        description="Register a prediction from one of your posts. It is priced at the moment you posted and scored automatically at expiry."
      />
      <Panel title="Register a call">
        <CallsControl />
      </Panel>
    </>
  );
}
