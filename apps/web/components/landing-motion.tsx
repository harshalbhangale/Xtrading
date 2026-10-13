"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";

gsap.registerPlugin(useGSAP, ScrollTrigger);
const MotionContext = createContext({ paused: false, toggle: () => {} });
export const useLandingMotion = () => useContext(MotionContext);

export function LandingMotion({
  children,
  className = "x-home",
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const entered = useRef(false);
  const [paused, setPaused] = useState(false);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add("(prefers-reduced-motion: no-preference)", () => {
        if (paused || !root.current) return;
        if (!entered.current) {
          gsap.from(".x-hero-line", {
            yPercent: 110,
            rotation: 3,
            duration: 1.15,
            stagger: 0.13,
            ease: "power4.out",
            clearProps: "all",
          });
          gsap.from(".x-hero-intro, .x-hero-actions, .x-stack", {
            y: 22,
            autoAlpha: 0,
            duration: 0.8,
            stagger: 0.13,
            delay: 0.5,
            ease: "power3.out",
            clearProps: "all",
          });
          entered.current = true;
        }
        root.current
          .querySelectorAll<HTMLElement>(
            ".x-section-heading, .x-principles > h2, .xp-detail-card, .x-paths > h2, .x-path, .x-install-banner, .x-flow-heading, .x-flow-board, .xp-detail-hero > div, .xp-detail-note, .x-creator-network, .x-tier-grid, .x-integrity-panel",
          )
          .forEach((element) => {
            gsap.from(element, {
              y: 65,
              autoAlpha: 0,
              duration: 1,
              ease: "power3.out",
              immediateRender: false,
              scrollTrigger: { trigger: element, start: "top 94%", once: true },
              clearProps: "all",
            });
          });
        if (root.current.querySelector(".x-hero"))
          gsap.to(".x-signal-field", {
            yPercent: 15,
            ease: "none",
            scrollTrigger: {
              trigger: ".x-hero",
              start: "top top",
              end: "bottom top",
              scrub: 1,
            },
          });
        const progress = root.current.querySelector(".x-scroll-progress");
        gsap.fromTo(
          progress,
          { scaleX: 0 },
          {
            scaleX: 1,
            transformOrigin: "left",
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 0.3,
            },
          },
        );
        const removers: (() => void)[] = [];
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          root.current
            .querySelectorAll<HTMLElement>(".xp-detail-card, .x-path")
            .forEach((element) => {
              const rotateX = gsap.quickTo(element, "rotationX", {
                duration: 0.65,
                ease: "power3.out",
              });
              const rotateY = gsap.quickTo(element, "rotationY", {
                duration: 0.65,
                ease: "power3.out",
              });
              gsap.set(element, { transformPerspective: 1100 });
              const move = (event: PointerEvent) => {
                if (event.pointerType !== "mouse") return;
                const box = element.getBoundingClientRect();
                const x = (event.clientX - box.left) / box.width;
                const y = (event.clientY - box.top) / box.height;
                element.style.setProperty("--spot-x", `${x * 100}%`);
                element.style.setProperty("--spot-y", `${y * 100}%`);
                rotateX((0.5 - y) * 5);
                rotateY((x - 0.5) * 5);
              };
              const leave = () => {
                rotateX(0);
                rotateY(0);
              };
              element.addEventListener("pointermove", move);
              element.addEventListener("pointerleave", leave);
              removers.push(() => {
                element.removeEventListener("pointermove", move);
                element.removeEventListener("pointerleave", leave);
                element.style.removeProperty("--spot-x");
                element.style.removeProperty("--spot-y");
              });
            });
        }
        root.current
          .querySelectorAll<HTMLElement>(".xp-button, .x-install-banner > b")
          .forEach((element) => {
            const xTo = gsap.quickTo(element, "x", {
              duration: 0.4,
              ease: "power3.out",
            });
            const yTo = gsap.quickTo(element, "y", {
              duration: 0.4,
              ease: "power3.out",
            });
            const move = (event: PointerEvent) => {
              if (event.pointerType !== "mouse") return;
              const bounds = element.getBoundingClientRect();
              xTo((event.clientX - bounds.left - bounds.width / 2) * 0.12);
              yTo((event.clientY - bounds.top - bounds.height / 2) * 0.2);
            };
            const leave = () => {
              xTo(0);
              yTo(0);
            };
            element.addEventListener("pointermove", move);
            element.addEventListener("pointerleave", leave);
            removers.push(() => {
              element.removeEventListener("pointermove", move);
              element.removeEventListener("pointerleave", leave);
            });
          });
        // Real post loading changes section height. Refresh scroll positions, not on every frame.
        let refreshFrame = 0;
        const observer = new ResizeObserver(() => {
          cancelAnimationFrame(refreshFrame);
          refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
        });
        observer.observe(root.current);
        const effects = root.current.querySelectorAll(
          ".x-signal-art, .x-signal-tape, .x-install-banner, .x-earn-flow, .x-post-trail, .x-tier-grid",
        );
        const visibility = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle(
              "x-effect-offscreen",
              !entry.isIntersecting,
            );
          });
        });
        effects.forEach((element) => {
          visibility.observe(element);
        });
        return () => {
          removers.forEach((remove) => {
            remove();
          });
          observer.disconnect();
          visibility.disconnect();
          effects.forEach((element) => {
            element.classList.remove("x-effect-offscreen");
          });
          cancelAnimationFrame(refreshFrame);
        };
      });
      return () => media.revert();
    },
    { scope: root, dependencies: [paused], revertOnUpdate: true },
  );
  return (
    <MotionContext.Provider
      value={{ paused, toggle: () => setPaused((value) => !value) }}
    >
      <div
        ref={root}
        className={`xp-page ${className} ${paused ? "x-motion-paused" : ""}`}
      >
        <div className="x-scroll-progress" aria-hidden="true" />
        {children}
      </div>
    </MotionContext.Provider>
  );
}
