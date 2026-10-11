import type { Metadata } from "next";
import Link from "next/link";
import { ExtensionPreview } from "../../components/extension-preview";

export const metadata: Metadata = { title: "X extension" };
export default function ExtensionPage() {
  return (
    <div className="page extension-page">
      <div className="extension-hero">
        <div>
          <p className="eyebrow">The feed is where it starts</p>
          <h1>
            Context.
            <br />
            Right next to
            <br />
            <span className="highlight">the claim.</span>
          </h1>
          <p className="hero-copy">
            Meet the X extension that brings creator identity, refundable stake
            and call evidence into your feed.
          </p>
          <div className="button-row">
            <a className="button" href="#install">
              Set up the development build ↗
            </a>
            <Link className="text-link" href="/dashboard">
              Open your workspace ↗
            </Link>
          </div>
          <p className="small-note">
            Current build: evidence links. Badges, popovers and trading are
            planned next.
          </p>
        </div>
        <ExtensionPreview />
      </div>
      <section className="extension-install" id="install">
        <div>
          <p className="eyebrow">01 / Development installation</p>
          <h2>
            From this workspace
            <br />
            to your feed.
          </h2>
          <p>
            The extension is not published in the Chrome Web Store. Use the
            local development build to start integrating.
          </p>
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
                Run <code>pnpm dev</code>. Visible posts get a “View creator
                evidence” link to the local app.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <div className="evidence-principles">
        <article>
          <span>01 / Identity</span>
          <h3>Know who is speaking.</h3>
          <p>
            Verified X ownership and wallet binding will be shown independently.
          </p>
        </article>
        <article>
          <span>02 / Record</span>
          <h3>Inspect the evidence.</h3>
          <p>
            Reputation needs sourced calls, transparent coverage and a published
            method.
          </p>
        </article>
        <article>
          <span>03 / Execution</span>
          <h3>Act with your approval.</h3>
          <p>
            Kuru trading will prepare a quote and transaction for explicit
            wallet approval.
          </p>
        </article>
      </div>
    </div>
  );
}
