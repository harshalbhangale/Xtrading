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
          <h2>Install</h2>
          <p>
            Not on the Chrome Web Store yet. Load it as an unpacked extension;
            it only talks to this site.
          </p>
          <a
            className="button"
            href="/downloads/tradepost-extension.zip"
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
                Posts by bound creators show identity and stake badges. When a
                post contains a call, the drawer offers a Kuru spot or Perpl
                perp review; nothing is signed outside your wallet.
              </p>
            </div>
          </li>
        </ol>
      </section>
    </div>
  );
}
