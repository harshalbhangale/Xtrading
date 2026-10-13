"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useLandingMotion } from "./landing-motion";

const steps = [
  {
    label: "Discover",
    icon: "𝕏",
    title: "Find your favourite KOL’s post.",
    copy: "Scroll your Twitter / X feed. See a token or trade call from a creator you follow? Open Xtrading right from the post.",
    note: "Creator context is there when you need it. The original post stays attached.",
    tags: ["Your X feed", "Your favourite KOL", "Original post"],
  },
  {
    label: "Trade",
    icon: "⇄",
    title: "Spot or perps. Right from X.",
    copy: "Buy or sell a supported token with Kuru spot, or open a supported Perpl perp trade. Choose your market and amount from the post’s trading flow.",
    note: "Available markets depend on configuration. Perp trades open a dedicated review workspace.",
    tags: ["Kuru spot", "Perpl perps", "Buy / sell"],
  },
  {
    label: "Approve",
    icon: "◎",
    title: "Your trade. Your approval.",
    copy: "Check the quote, fees and trade details. For perps, review leverage and risk too. Approve the transaction in your own wallet when you’re ready.",
    note: "Every trade needs your approval. Monad testnet is the default.",
    tags: ["Review details", "Check fees", "Wallet approval"],
  },
  {
    label: "Done",
    icon: "↗",
    title: "Back to the feed. Trade tracked.",
    copy: "Follow your transaction status and confirmed fills in the dashboard. Keep scrolling, discover the next post, and keep your positions in view.",
    note: "A submitted order is pending until a fill is confirmed. Call results and wallet returns stay separate.",
    tags: ["Transaction status", "Confirmed fills", "Your dashboard"],
  },
] as const;

export function AnimatedFlow() {
  const root = useRef<HTMLElement>(null);
  const panelId = useId();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const { paused } = useLandingMotion();
  const running = playing && visible && !paused && !reduced && pageVisible;
  const step = steps[active] ?? steps[0];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    update();
    visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.2 },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(
      () => setActive((active + 1) % steps.length),
      6500,
    );
    return () => clearTimeout(timer);
  }, [running, active]);
  useGSAP(
    () => {
      if (reduced || paused) return;
      gsap.fromTo(
        ".x-flow-detail > *, .x-flow-visual",
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.06,
          duration: 0.55,
          ease: "power3.out",
          clearProps: "all",
        },
      );
    },
    {
      scope: root,
      dependencies: [active, reduced, paused],
      revertOnUpdate: true,
    },
  );

  return (
    <section
      ref={root}
      className={`x-flow ${running ? "x-flow-running" : "x-flow-still"}`}
      id="how-it-works"
      aria-label="How Xtrading works"
    >
      <div className="x-flow-heading">
        <div>
          <p className="xp-eyebrow">HOW IT WORKS / POST TO POSITION</p>
          <h2>
            From your feed.
            <br />
            <span>Into the trade.</span>
          </h2>
        </div>
        <p>
          Discover. Spot or perps. Done.
          <br />
          You stay in control of the trade.
        </p>
      </div>
      <div className="x-flow-board">
        <div className="x-flow-topline">
          <span>
            <i /> DISCOVER → TRADE → APPROVE → DONE
          </span>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-pressed={!playing}
            disabled={reduced}
          >
            {reduced
              ? "Motion reduced"
              : playing
                ? "Pause walkthrough"
                : "Play walkthrough"}
          </button>
        </div>
        <ol className="x-flow-track" aria-label="Choose a step">
          {steps.map((item, index) => (
            <li
              key={item.label}
              data-active={active === index}
              data-passed={index < active}
            >
              <button
                type="button"
                aria-pressed={active === index}
                aria-controls={panelId}
                onClick={() => {
                  setActive(index);
                  setPlaying(false);
                }}
              >
                <span className="x-flow-node" aria-hidden="true">
                  {item.icon}
                  <i />
                </span>
                <span className="x-flow-step-label">
                  <small>0{index + 1}</small> {item.label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <span className="x-flow-wire" aria-hidden="true">
                  <i />
                  <b>→</b>
                </span>
              )}
            </li>
          ))}
        </ol>
        <div className="x-flow-panel" id={panelId}>
          <div className="x-flow-visual" data-stage={active} aria-hidden="true">
            <div className="x-flow-orbit">
              <i />
              <i />
              <i />
            </div>
            <div className="x-flow-object">
              <span className="x-flow-object-icon">{step.icon}</span>
              {active === 0 ? (
                <div className="x-flow-post-lines">
                  <i />
                  <i />
                  <i />
                  <b>TRADE THIS POST ↗</b>
                </div>
              ) : active === 1 ? (
                <div className="x-flow-evidence">
                  {["SPOT", "PERPS", "BUY", "SELL"].map((label) => (
                    <span key={label}>
                      <i />
                      {label}
                    </span>
                  ))}
                </div>
              ) : active === 2 ? (
                <div className="x-flow-review">
                  <span>REVIEW DETAILS</span>
                  <i />
                  <i />
                  <b>YOU APPROVE ↗</b>
                </div>
              ) : (
                <div className="x-flow-receipt">
                  <span>YOUR TRADE STATUS</span>
                  <i />
                  <i />
                  <b>TRACK THE OUTCOME ↗</b>
                </div>
              )}
            </div>
            <span className="x-flow-visual-caption">
              0{active + 1} / {step.label.toUpperCase()}
            </span>
          </div>
          <div className="x-flow-detail">
            <p className="xp-eyebrow">
              STEP 0{active + 1} / {step.label.toUpperCase()}
            </p>
            <h3>{step.title}</h3>
            <p>{step.copy}</p>
            <div className="x-flow-tags">
              {step.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
            <p className="x-flow-note">{step.note}</p>
            <Link
              href={
                active === 0
                  ? "#try-it"
                  : active === 1
                    ? "/extension"
                    : active === 2
                      ? "/dashboard/trade"
                      : "/dashboard"
              }
              className="xp-text-link"
            >
              {active === 0
                ? "Try a real X post"
                : active === 1
                  ? "Get trading on X"
                  : active === 2
                    ? "Open trade review"
                    : "Open your dashboard"}{" "}
              <span>↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
