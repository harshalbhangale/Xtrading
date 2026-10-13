import type { Metadata } from "next";
import { PageHeading } from "../../components/dashboard/ui";
import { Terminal } from "../../components/terminal";

export const metadata: Metadata = { title: "Terminal" };
export default function DashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Live feed"
        title="Terminal"
        description="Calls from the creators you follow, as they post. Follow or fade, check if a call was deleted, and trade it."
      />
      <Terminal />
    </>
  );
}
