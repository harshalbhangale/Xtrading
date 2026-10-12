"use client";

import { useEffect, useRef } from "react";

// Decorative only: random-walk price lines drifting left, one highlighted
// "live" line with a head marker. Draws one static frame under reduced motion.
const STEP = 7; // px between samples
const SPEED = 14; // px per second

type Series = {
  values: number[];
  base: number; // 0..1 of height
  spread: number; // px amplitude scale
  live: boolean;
};

function walk(series: Series, height: number) {
  const last = series.values.at(-1) ?? series.base * height;
  const target = series.base * height;
  const next =
    last + (Math.random() - 0.5) * series.spread + (target - last) * 0.035; // gentle pull back towards the baseline
  series.values.push(next);
}

export function FlowBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let series: Series[] = [];
    let offset = 0;
    let frame = 0;
    let last = 0;

    const seed = () => {
      const count = Math.ceil(width / STEP) + 3;
      series = [
        { base: 0.24, spread: 7, live: false, values: [] },
        { base: 0.4, spread: 9, live: false, values: [] },
        { base: 0.58, spread: 12, live: true, values: [] },
        { base: 0.74, spread: 8, live: false, values: [] },
        { base: 0.88, spread: 6, live: false, values: [] },
      ];
      for (const line of series)
        for (let index = 0; index < count; index++) walk(line, height);
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
      draw();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const headX = width * (width > 1100 ? 0.89 : 0.82);
      for (const line of series) {
        const { values } = line;
        context.beginPath();
        let headY = 0;
        for (let index = 0; index < values.length; index++) {
          const x = index * STEP - offset;
          const y = values[index] ?? 0;
          if (line.live && x > headX) break;
          headY = y;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        if (line.live) {
          context.strokeStyle = "rgba(198, 242, 90, 0.75)";
          context.lineWidth = 1.6;
          context.stroke();
          // Area under the live line.
          context.lineTo(headX, height);
          context.lineTo(-offset, height);
          context.closePath();
          const fill = context.createLinearGradient(0, headY, 0, height);
          fill.addColorStop(0, "rgba(198, 242, 90, 0.10)");
          fill.addColorStop(1, "rgba(198, 242, 90, 0)");
          context.fillStyle = fill;
          context.fill();
          // Dashed level from the head to the right edge.
          context.save();
          context.setLineDash([3, 5]);
          context.strokeStyle = "rgba(198, 242, 90, 0.35)";
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(headX, headY);
          context.lineTo(width, headY);
          context.stroke();
          context.restore();
          // Head marker with a slow pulse.
          const pulse = (Math.sin(performance.now() / 420) + 1) / 2;
          context.fillStyle = `rgba(198, 242, 90, ${0.12 + pulse * 0.12})`;
          context.beginPath();
          context.arc(headX, headY, 9 + pulse * 5, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = "#c6f25a";
          context.beginPath();
          context.arc(headX, headY, 3.2, 0, Math.PI * 2);
          context.fill();
        } else {
          context.strokeStyle = "rgba(184, 194, 183, 0.13)";
          context.lineWidth = 1.2;
          context.stroke();
        }
      }
    };

    const tick = (now: number) => {
      const elapsed = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      offset += elapsed * SPEED;
      while (offset >= STEP) {
        offset -= STEP;
        for (const line of series) {
          line.values.shift();
          walk(line, height);
        }
      }
      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      last = 0;
      if (!reduced.matches) frame = requestAnimationFrame(tick);
      else draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    start();
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener("change", start);
    };
  }, []);
  return (
    <div className="start-background" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
