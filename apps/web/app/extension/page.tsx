import type { Metadata } from "next";
import Link from "next/link";
import { LiveXDemo } from "../../components/live-x-demo";

export const metadata: Metadata = { title: "X extension" };
export default function ExtensionPage() {
  return (
    <div className="xp-page xp-detail">
      <div className="xp-detail-hero">
        <div>
          <p className="xp-eyebrow">YOUR FEED, WITH MORE CONTEXT</p>
          <h1>
            The record,
            <br />
            <span className="xp-highlight">under the post.</span>
          </h1>
          <p className="xp-lead">
            A Chrome extension for X. Inspect creator records on profiles and
            open the call drawer on detected trade calls, with identity, stake
            and wallet-reviewed Kuru spot or Perpl perp trade links.
          </p>
          <div className="xp-actions">
            <a className="xp-button" href="#install">
              Install ↗
            </a>
            <Link className="xp-text-link" href="/creators">
              Browse creators ↗
            </Link>
          </div>
        </div>
        <LiveXDemo />
      </div>
      <section className="extension-install" id="install">
        <div>
          <h2>Install</h2>
          <p>
            Not on the Chrome Web Store yet. Load it as an unpacked extension;
            it only talks to this site.
          </p>
          <a
            className="xp-button"
            href="/downloads/xtrading-extension.zip"
            download
          >
            Download extension (.zip)
          </a>
        </div>
        <ol className="install-steps">
          <li>
            <span>01</span>
            <div>
              <strong>Unzip it</strong>
              <p>Extract the download to a folder you will keep.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Load it in Chrome</strong>
              <p>
                Open <code>chrome://extensions</code>, turn on Developer mode,
                choose Load unpacked and select the unzipped folder.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Open X</strong>
              <p>
                Profiles expose the creator record. Detected trade calls open an
                evidence drawer and a Kuru spot or Perpl perp review; signing
                stays with your wallet.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
