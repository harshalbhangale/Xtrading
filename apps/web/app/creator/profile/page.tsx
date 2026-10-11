import type { Metadata } from "next";
import { ProfileDraft } from "../../../components/dashboard/profile-draft";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
import { IdentityControl } from "../../../components/identity-control";

export const metadata: Metadata = { title: "Identity and profile" };
export default function ProfilePage() {
  return (
    <>
      <PageHeading
        eyebrow="02 / Identity & profile"
        title="Start with who you are."
        description="Prepare your public profile, then prove account and wallet ownership before publishing."
      />
      <div className="dashboard-two-column">
        <Panel
          title="Your profile draft"
          description="Draft fields are local and never count as verified identity."
        >
          <ProfileDraft />
        </Panel>
        <div className="identity-stack">
          <Panel title="Identity receipts">
            <IdentityControl
              serverConfigured={Boolean(process.env.PRIVY_APP_SECRET)}
            />
          </Panel>
          <div className="editorial-note">
            <h3>
              A handle can change.
              <br />
              Your proof should not.
            </h3>
            <p>
              Your verified record will bind a stable X user ID to a wallet.
              Profile text and display handles stay separate from that proof.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
