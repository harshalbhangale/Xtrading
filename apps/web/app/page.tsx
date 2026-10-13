import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedFlow } from "../components/animated-flow";
import { CreatorProgram } from "../components/creator-program";
import { KineticHero } from "../components/kinetic-hero";
import { LandingMotion } from "../components/landing-motion";
import { LiveXDemo } from "../components/live-x-demo";
import { SignalArt } from "../components/signal-art";

export const metadata: Metadata = {
  title: "Xtrading — spot and perps, right from X",
};
export default function LandingPage() {
  // Spot trading is on testnet and, when enabled for this deployment, mainnet.
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  const mainnet = process.env.KURU_MAINNET_ENABLED === "true";
  const networks =
    mainnet && testnet
      ? "Monad testnet and mainnet"
      : mainnet
        ? "Monad mainnet"
        : "Monad testnet";
  return (
    <LandingMotion>
      <KineticHero networks={networks} />
      <div className="x-signal-tape" aria-hidden="true">
        <div>
          {["first", "second"].map((key) => (
            <span key={key}>
              DISCOVER YOUR KOL <i>↗</i> TRADE FROM X <i>↗</i> SPOT OR PERPS{" "}
              <i>↗</i> YOUR WALLET. YOUR MOVE. <i>↗</i>
            </span>
          ))}
        </div>
      </div>
      <AnimatedFlow />
      <section className="x-demo-section" id="try-it">
        <div className="x-section-heading">
          <p className="xp-eyebrow">01 / TRY IT ON A REAL POST</p>
          <h2>
            Find the post.
            <br />
            Find your next trade.
          </h2>
          <p>
            Paste a public X post from your favourite KOL.
            <br />
            See the call, check the context, and explore supported trades.
          </p>
        </div>
        <LiveXDemo />
      </section>
      <section className="x-principles">
        <p className="xp-eyebrow">02 / KNOW WHAT YOU’RE LOOKING AT</p>
        <h2>
          One feed.
          <br />
          Separate signals.
        </h2>
        <div className="xp-feature-grid">
          {[
            [
              "01 / IDENTITY",
              "Who’s behind the call?",
              "An X account bound to a wallet. Ownership evidence, with a stable identity.",
              "/creators",
              "Explore creator records",
            ],
            [
              "02 / CALL RESULTS",
              "How did the calls perform?",
              "A complete call history with outcomes and sample size. Actual user profits require separate trade evidence.",
              "/for-creators",
              "Build your record",
            ],
            [
              "03 / EXECUTION",
              "What actually settled?",
              "Review the trade in your wallet. Confirmed fills and wallet returns stay separate from call results.",
              "/dashboard/trade",
              "Open trade review",
            ],
          ].map(([n, title, copy, href, label]) => (
            <article className="xp-detail-card" key={n}>
              <SignalArt
                kind={
                  n?.includes("IDENTITY")
                    ? "identity"
                    : n?.includes("CALL RESULTS")
                      ? "stake"
                      : "execution"
                }
              />
              <span>{n}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <Link className="xp-text-link" href={href ?? "/"}>
                {label} ↗
              </Link>
            </article>
          ))}
        </div>
      </section>
      <CreatorProgram />
      <section className="x-paths" aria-labelledby="paths-title">
        <p className="xp-eyebrow">03 / TWO WAYS IN</p>
        <h2 id="paths-title">
          Read the calls.
          <br />
          Or make them count.
        </h2>
        <div className="x-path-grid">
          <Link className="x-path" href="/start">
            <span className="xp-eyebrow">USER LOGIN</span>
            <h3>Follow calls and trade</h3>
            <p>
              Check any creator’s identity and call history, then review Kuru
              spot or Perpl perp trades before your wallet opens.
            </p>
            <b>Open the dashboard →</b>
          </Link>
          <Link className="x-path" href="/start">
            <span className="xp-eyebrow">CREATOR LOGIN</span>
            <h3>Build a public record</h3>
            <p>
              Bind your X account to a wallet and register calls that are scored
              at expiry.
            </p>
            <b>Open the creator studio →</b>
          </Link>
        </div>
      </section>
      <Link className="x-install-banner" href="/extension">
        <span>𝕏</span>
        <div>
          <strong>Your next trade. In your feed.</strong>
          <p>Install the Chrome extension. Discover a post. Start a trade.</p>
        </div>
        <b>Get the extension ↗</b>
      </Link>
    </LandingMotion>
  );
}
