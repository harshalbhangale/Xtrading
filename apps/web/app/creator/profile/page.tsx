import type { Metadata } from "next";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { IdentityControl } from "../../../components/identity-control";

export const metadata: Metadata = { title: "Identity" };
export default function ProfilePage() {
  return (
    <>
      <PageHeading
        title="Identity"
        description="Bind your stable X ID to a wallet with a signed, single-use message."
      />
      <Panel title="X and wallet binding">
        <IdentityControl
          serverConfigured={Boolean(process.env.PRIVY_APP_SECRET)}
        />
      </Panel>
    </>
  );
}
