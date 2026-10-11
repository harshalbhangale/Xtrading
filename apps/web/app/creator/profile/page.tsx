import type { Metadata } from "next";
import Link from "next/link";
import { ProfileDraft } from "../../../components/dashboard/profile-draft";
import { PageHeading, Panel } from "../../../components/dashboard/ui";

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
            <div className="identity-row">
              <span aria-hidden="true">𝕏</span>
              <div>
                <strong>X account ownership</strong>
                <p>Server-verified session and stable user ID required.</p>
              </div>
              <span className="status-badge">Unlinked</span>
            </div>
            <div className="identity-row">
              <span aria-hidden="true">◇</span>
              <div>
                <strong>Wallet ownership</strong>
                <p>Signed challenge with nonce and expiration required.</p>
              </div>
              <span className="status-badge">Unbound</span>
            </div>
            <Link className="button secondary-button" href="/setup">
              Set up authentication ↗
            </Link>
            <p className="small-note">
              Login configuration is available. Identity binding and publishing
              are not connected yet.
            </p>
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
