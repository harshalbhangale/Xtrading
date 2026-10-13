"use client";
import { useEffect, useRef } from "react";
import { useLandingMotion } from "./landing-motion";

/** Original 3D particle knot, projected onto a halftone canvas. No price or activity data. */
export function SignalField({ mode = "default" }: { mode?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { paused } = useLandingMotion();
  const activeMode = useRef(mode);
  const elapsed = useRef(0);
  useEffect(() => {
    activeMode.current = mode;
  }, [mode]);
  useEffect(() => {
    const element = canvas.current,
      context = element?.getContext("2d");
    if (!element || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      last = 0,
      time = elapsed.current,
      width = 0,
      height = 0,
      visible = true,
      pointerX = 0,
      pointerY = 0,
      targetX = 0,
      targetY = 0,
      currentMorph = 0,
      currentTint = 0;
    const points: { u: number; v: number }[] = [];
    for (let ring = 0; ring < 180; ring++)
      for (let tube = 0; tube < 28; tube++)
        points.push({
          u: (ring / 180) * Math.PI * 2,
          v: (tube / 28) * Math.PI * 2,
        });
    function size() {
      if (!element || !context) return;
      width = element.clientWidth;
      height = element.clientHeight;
      const ratio = Math.min(window.devicePixelRatio, 1.5);
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    function draw(now: number) {
      if (!context) return;
      if (now - last > 32 || !last) {
        const delta = last ? Math.min((now - last) / 1000, 0.05) : 0;
        last = now;
        if (!paused && !reduced.matches && !document.hidden && visible)
          time = elapsed.current += delta * 0.55;
        pointerX += (targetX - pointerX) * 0.065;
        pointerY += (targetY - pointerY) * 0.065;
        context.clearRect(0, 0, width, height);
        const scale = Math.min(width, height) * 0.34;
        const rotation = time * 0.3 + pointerX * 0.65,
          tilt = 0.65 + pointerY * 0.4;
        const variant = activeMode.current;
        const targetMorph =
          variant === "Kuru"
            ? 0.28
            : variant === "Privy"
              ? -0.2
              : variant === "Envio"
                ? 0.12
                : variant === "Nansen"
                  ? -0.1
                  : 0;
        currentMorph += (targetMorph - currentMorph) * 0.055;
        currentTint +=
          ((variant === "Kuru" || variant === "Nansen" ? 1 : 0) - currentTint) *
          0.055;
        const morph = currentMorph;
        const ca = Math.cos(rotation),
          sa = Math.sin(rotation),
          ct = Math.cos(tilt),
          st = Math.sin(tilt);
        for (const { u, v } of points) {
          const twist = v + u * 3 + Math.sin(u * 3 + time) * 0.4;
          const radius =
            1 + 0.15 * Math.cos(u * 3 + time) + morph * Math.sin(u * 2);
          const tube = 0.33 + 0.09 * Math.sin(u * 4 - time * 0.8);
          const rawX = (radius + tube * Math.cos(twist)) * Math.cos(u);
          const rawY = (radius + tube * Math.cos(twist)) * Math.sin(u);
          const rawZ = tube * Math.sin(twist) + 0.2 * Math.cos(u * 3 + time);
          const rx = rawX * ca + rawZ * sa,
            rz = -rawX * sa + rawZ * ca;
          const ry = rawY * ct - rz * st,
            z = rawY * st + rz * ct;
          const perspective = 3.5 / (3.5 - z);
          const x = width * 0.56 + rx * scale * perspective,
            y = height * 0.5 + ry * scale * perspective;
          const brightness = Math.max(0.12, Math.min(1, (z + 1.8) / 3));
          context.fillStyle = `rgba(${Math.round(118 + currentTint * 48)},${Math.round(138 + currentTint * 67)},${Math.round(116 - currentTint * 30)},${brightness * (0.36 + currentTint * 0.08)})`;
          context.beginPath();
          context.arc(
            x,
            y,
            Math.max(0.35, (0.7 + brightness * 1.15) * perspective),
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
      if (!paused && !reduced.matches && visible && !document.hidden)
        frame = requestAnimationFrame(draw);
    }
    function restart() {
      cancelAnimationFrame(frame);
      last = 0;
      draw(performance.now());
    }
    const hero = element.closest(".x-hero");
    const pointer = (event: Event) => {
      if (
        !(event instanceof PointerEvent) ||
        event.pointerType !== "mouse" ||
        paused
      )
        return;
      const bounds = hero?.getBoundingClientRect();
      if (!bounds) return;
      targetX = (event.clientX - bounds.left) / bounds.width - 0.5;
      targetY = (event.clientY - bounds.top) / bounds.height - 0.5;
    };
    const leave = () => {
      targetX = 0;
      targetY = 0;
    };
    hero?.addEventListener("pointermove", pointer);
    hero?.addEventListener("pointerleave", leave);
    const resize = new ResizeObserver(() => {
      size();
      restart();
    });
    resize.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      restart();
    });
    intersection.observe(element);
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      hero?.removeEventListener("pointermove", pointer);
      hero?.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
    };
  }, [paused]);
  return (
    <div className="x-signal-field" aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  );
}
