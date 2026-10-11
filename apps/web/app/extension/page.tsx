import type { Metadata } from "next";
import Link from "next/link";
import { ExtensionPreview } from "../../components/extension-preview";

export const metadata: Metadata = { title: "X extension" };
export default function ExtensionPage() {
  return (
    <div className="page extension-page">
      <div className="extension-hero">
        <div>
          <h1>
            The record,
            <br />
            <span className="highlight">under the post.</span>
          </h1>
          <p className="hero-copy">
            A Chrome extension for X. Under each post it shows whether the
            author has bound their account and whether their stake is active,
            with Buy and Sell links that open a Kuru trade review here.
          </p>
          <div className="button-row">
            <a className="button" href="#install">
              Install ↗
            </a>
            <Link className="text-link" href="/creators">
              Browse creators ↗
            </Link>
          </div>
        </div>
        <ExtensionPreview />
      </div>
      <section className="extension-install" id="install">
        <div>
          <h2>Install the developer build</h2>
          <p>Not yet on the Chrome Web Store.</p>
        </div>
        <ol className="install-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Build the extension</strong>
              <code>pnpm --filter @call-my-bluff/extension build</code>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Load the local folder</strong>
              <p>
                In Chrome, open <code>chrome://extensions</code>, enable
                developer mode, then load <code>apps/extension/dist</code> as an
                unpacked extension.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Start the app and open X</strong>
              <p>
                Run <code>pnpm dev</code> and the Envio indexer. Visible posts
                get separate evidence indicators and Buy/Sell links to wallet
                review.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
