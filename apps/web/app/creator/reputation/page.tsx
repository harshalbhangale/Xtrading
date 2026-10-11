import type { Metadata } from "next";
import {
  EmptyState,
  PageHeading,
  Panel,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Reputation" };

export default function ReputationPage() {
  return (
    <>
      <PageHeading
        title="Reputation"
        description="Call performance under a published methodology, with sample size and coverage alongside every number."
      />
      <Panel title="Performance">
        <EmptyState
          title="No score yet."
          description="A score appears only once enough registered calls have expired and been evaluated. Until then nothing is shown, not a zero."
        />
      </Panel>
    </>
  );
}
