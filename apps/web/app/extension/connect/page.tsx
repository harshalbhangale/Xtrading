import type { Metadata } from "next";
import { ExtensionConnect } from "../../../components/extension-connect";

export const metadata: Metadata = { title: "Connect the X extension" };

export default function ExtensionConnectPage() {
  return (
    <section className="page connect-page">
      <h1>Connect Xtrading on X</h1>
      <p>
        Lets the extension place perp orders from X for your bound account. It
        never sees your Privy session, keys or wallet, and expires after 7 days.
      </p>
      <ExtensionConnect />
    </section>
  );
}
