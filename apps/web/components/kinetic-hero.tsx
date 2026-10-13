"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLandingMotion } from "./landing-motion";
import { SignalField } from "./signal-field";

const copy = {
  default: {
    lines: ["SEE THE POST.", "TRADE IT.", "STAY ON X."],
    body: (networks: string) =>
      `Discover your favourite KOL’s next call.\nBuy, sell, go spot or perps — right from X.\nYour wallet. Your approval. Spot on ${networks}.`,
  },
  Kuru: {
    lines: ["FROM THE POST.", "TO YOUR", "POSITION."],
    body: "Kuru brings configured spot markets to the flow.\nInspect the call, review the amount,\nthen approve with your own wallet.",
  },
  Privy: {
    lines: ["YOUR IDENTITY.", "YOUR WALLET.", "YOUR MOVE."],
    body: "Sign in with X through Privy.\nBind your account to your wallet.\nEvery trade still needs your approval.",
  },
  Envio: {
    lines: ["THE CHAIN", "KEEPS THE", "RECEIPTS."],
    body: "Envio indexes trading and creator payment events.\nFreshness and confirmed activity matter.\nAn order is only a fill when the evidence says so.",
  },
  Nansen: {
    lines: ["LOOK BEYOND", "THE POST.", "CHECK THE WALLET."],
    body: "Nansen adds sourced wallet context.\nInspect the network, timestamp and coverage.\nSee the observations behind the summary.",
  },
} as const;
type Mode = keyof typeof copy;

function TypedLine({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (
      !animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(text);
      return;
    }
    let position = 0;
    setShown("");
    const timer = setInterval(() => {
      position += 2;
      setShown(text.slice(0, position));
      if (position >= text.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [text, animate]);
  return <span>{shown}</span>;
}
export function KineticHero({
  networks = "Monad testnet",
}: {
  networks?: string;
}) {
  const [mode, setMode] = useState<Mode>("default");
  const interacted = useRef(false);
  const { paused, toggle } = useLandingMotion();
  const active = copy[mode];
  const select = (value: Mode) => {
    interacted.current = true;
    setMode(value);
  };
  return (
    <section className="x-hero" data-signal-mode={mode}>
      <SignalField mode={mode} />
      <div className="x-hero-content">
        <p className="xp-eyebrow x-hero-intro">
          <span className="x-pixel-tag">XTRADING</span> / SOCIAL SIGNAL. ONCHAIN
          CONTEXT.
          <span className="x-terminal-cursor" aria-hidden="true">
            _
          </span>
        </p>
        <h1 aria-label={active.lines.join(" ")}>
          {active.lines.map((line, index) => (
            <span
              className="x-line-mask"
              key={`line-${index === 0 ? "first" : index === 1 ? "middle" : "last"}`}
              aria-hidden="true"
            >
              <span className="x-hero-line">
                <TypedLine
                  text={line}
                  animate={interacted.current && !paused}
                />
                {index === 2 && <span className="x-type-caret" />}
              </span>
            </span>
          ))}
        </h1>
        <p className="x-hero-intro x-hero-description" key={mode}>
          {typeof active.body === "function"
            ? active.body(networks)
            : active.body}
        </p>
        <div className="xp-actions x-hero-actions">
          <Link href="/start" className="xp-button">
            Get started <span>↗</span>
          </Link>
          <a href="#try-it" className="xp-text-link">
            Try a real X post <span>↓</span>
          </a>
          <a
            href="https://x.com/Xtradingnow"
            target="_blank"
            rel="noopener noreferrer"
            className="xp-text-link"
          >
            Follow @Xtradingnow on X <span>↗</span>
          </a>
        </div>
        <div className="x-stack">
          <span>
            CORE MVP STACK{" "}
            <span className="x-stack-hint">/ EXPLORE EACH LAYER</span>
          </span>
          <div>
            {(["Kuru", "Privy", "Envio", "Nansen"] as const).map((sponsor) => (
              <button
                key={sponsor}
                type="button"
                aria-pressed={mode === sponsor}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") select(sponsor);
                }}
                onClick={() => select(sponsor)}
                onFocus={() => select(sponsor)}
                onBlur={() => setMode("default")}
                onPointerLeave={(event) => {
                  if (event.pointerType === "mouse") setMode("default");
                }}
              >
                {sponsor}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <span className="x-scroll-note">
        FROM POST TO POSITION <span aria-hidden="true">↓</span>
      </span>
      <button
        className="x-motion-toggle"
        type="button"
        aria-pressed={paused}
        onClick={toggle}
      >
        {paused ? "Resume motion" : "Pause motion"}
      </button>
    </section>
  );
}
