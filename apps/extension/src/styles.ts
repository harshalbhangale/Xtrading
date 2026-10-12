// Scoped to shadow roots so X's styles never leak in and ours never leak out.
export const css = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: inherit; }
.badge { display: inline-flex; gap: 4px; margin-left: 4px; vertical-align: middle; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; border-radius: 999px;
  font: 600 11px/18px system-ui; border: 1px solid; white-space: nowrap; cursor: pointer; }
.chip.verified { color: #1d6b2a; background: #e3f6dc; border-color: #9fd38e; }
.chip.staked { color: #4b2fa6; background: #ece6ff; border-color: #b9a6f4; }
.chip.muted { color: #5b6170; background: #f1f2f5; border-color: #d6d9e0; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0 2px;
  padding: 8px 10px; border-radius: 12px; border: 1px solid #c8bdf2; background: #f7f4ff; color: #24193f;
  font: 13px/1.4 system-ui; }
.bar .label { font-weight: 700; }
.bar .meta { color: #5d5478; font-size: 12px; }
.bar.unrouted { background: #f5f6f8; border-color: #d8dbe2; color: #3b4150; }
.btn { appearance: none; border: 0; border-radius: 999px; padding: 6px 14px; font: 700 12px system-ui;
  background: #1f1a2e; color: #fff; cursor: pointer; }
.btn:hover { background: #3a2f63; }
.btn.secondary { background: transparent; color: #3a2f63; border: 1px solid #b9a6f4; }
.btn:focus-visible, .chip:focus-visible { outline: 3px solid #7b61ff; outline-offset: 2px; }
.dir-bullish { color: #13753a; } .dir-bearish { color: #b42318; }
.drawer { position: fixed; top: 0; right: 0; width: min(400px, 100vw); height: 100vh; overflow-y: auto;
  z-index: 2147483000; background: #fbfaff; color: #1f1a2e; box-shadow: -12px 0 40px rgba(20,10,50,.25);
  border-left: 1px solid #d9d1f7; font: 13px/1.5 system-ui; }
.drawer header { position: sticky; top: 0; display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px; background: #1f1a2e; color: #fff; }
.drawer header strong { font-size: 15px; }
.drawer header button { background: none; border: 0; color: #fff; font-size: 20px; cursor: pointer; }
.section { padding: 14px 16px; border-bottom: 1px solid #ebe6fb; }
.section h3 { margin: 0 0 8px; font: 700 11px/1 ui-monospace, monospace; letter-spacing: .08em;
  text-transform: uppercase; color: #6b5fa0; }
.row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; }
.row span:first-child { color: #6b6585; }
.row span:last-child { text-align: right; font-weight: 600; overflow-wrap: anywhere; }
.pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; }
.pill.contradiction { background: #fde4e1; color: #a5281b; }
.pill.consistent { background: #e3f6dc; color: #1d6b2a; }
.pill.neutral { background: #eef0f4; color: #454b5a; }
.tag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px; font: 700 10px/16px ui-monospace, monospace;
  background: #fff1c2; color: #7a5a00; border: 1px solid #f0d27a; }
.note { color: #6b6585; font-size: 12px; margin: 6px 0 0; }
.finding { margin: 6px 0 0; padding: 6px 8px; border-radius: 8px; background: #fff; border: 1px solid #ebe6fb; }
.cta { display: block; text-align: center; text-decoration: none; margin-top: 10px; padding: 11px; border-radius: 10px;
  background: #d8f58a; color: #1d2410; font-weight: 800; }
.cta.disabled { background: #e4e6ea; color: #7a7f8a; pointer-events: none; }
.card { margin: 12px 0; padding: 14px 16px; border-radius: 16px; border: 1px solid #c8bdf2; background: #f7f4ff;
  color: #1f1a2e; font: 13px/1.5 system-ui; }
.card .title { display: flex; justify-content: space-between; align-items: center; font-weight: 800; margin-bottom: 8px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat { padding: 8px; border-radius: 10px; background: #fff; border: 1px solid #ebe6fb; }
.stat b { display: block; font-size: 15px; }
.stat small { color: #6b6585; }

/* Tradepost verified badge */
.tp-badge { display: inline-grid; place-items: center; position: relative; vertical-align: middle;
  flex-shrink: 0; cursor: pointer; isolation: isolate; outline: none; margin: 0 4px; }
.tp-badge.tp-static { cursor: default; }
/* Feed badges can sit inside rows X clips; keep their glow within the badge box. */
.tp-static .tp-aura { inset: 12%; filter: blur(3px); animation: tp-glow-inner 2s ease-in-out infinite; }
.tp-static .tp-logo { box-shadow: 0 0 5px #692effaa; animation: tp-pulse-inner 2s ease-in-out infinite; }
.tp-static .tp-ring { width: 100%; box-shadow: none; }
.tp-static .tp-ring-b { width: 94%; }
.tp-badge:focus-visible { outline: 2px solid #baff72; outline-offset: 4px; border-radius: 9px; }
.tp-aura { position: absolute; inset: 0; border-radius: 50%; background: #742fff55; filter: blur(8px);
  animation: tp-glow 2s ease-in-out infinite; pointer-events: none; }
.tp-logo { position: relative; z-index: 3; width: 72%; height: 72%; display: grid; place-items: center;
  border-radius: 28%; background: #4f1ff0; box-shadow: 0 0 12px #692effaa, 0 0 26px #642cff55;
  overflow: hidden; animation: tp-pulse 2s ease-in-out infinite; transition: transform 180ms ease; }
.tp-mark { color: #fff; font: 900 0.42em/1 Inter, system-ui, sans-serif; letter-spacing: -0.07em; z-index: 2; }
.tp-badge:hover .tp-logo { transform: scale(1.1); }
.tp-ring { position: absolute; width: 112%; height: 44%; border: 1.5px solid #43f4d0; border-radius: 50%;
  box-shadow: 0 0 8px #43f4d088; pointer-events: none; }
.tp-ring-a { animation: tp-orbit 3s linear infinite; }
.tp-ring-b { width: 104%; height: 54%; border-color: #c2ff52; animation: tp-reverse 4s linear infinite; }
.tp-sweep { position: absolute; left: -40%; top: -15%; height: 130%; width: 25%;
  background: linear-gradient(90deg, transparent, #ffffffbb, transparent);
  transform: rotate(25deg); animation: tp-sweep 3s ease-in-out infinite; }
.tp-spark { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #d4ff73;
  box-shadow: 0 0 7px #d4ff73; z-index: 4; pointer-events: none; animation: tp-spark 1.8s ease-in-out infinite; }
.tp-spark-a { right: 0; top: 2%; }
.tp-spark-b { left: 0; bottom: 3%; background: #43f4d0; animation-delay: -.7s; }
.tp-tooltip { position: absolute; bottom: calc(100% + 12px); left: 50%; width: max-content;
  max-width: min(260px, 80vw); box-sizing: border-box; display: flex; flex-direction: column; gap: 5px;
  padding: 11px 13px; border: 1px solid #574080; border-radius: 11px; background: #171322; color: #f7f3ff;
  box-shadow: 0 8px 30px #0009; opacity: 0; visibility: hidden; transform: translate(-50%, 5px);
  transition: opacity 180ms ease, transform 180ms ease; pointer-events: none; z-index: 1000; }
.tp-tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; width: 9px; height: 9px;
  background: #171322; border-right: 1px solid #574080; border-bottom: 1px solid #574080;
  transform: translate(-50%, -5px) rotate(45deg); }
/* Flipped when there is no room above, e.g. a profile header near the viewport top. */
.tp-badge.tp-flip .tp-tooltip { bottom: auto; top: calc(100% + 12px); }
.tp-badge.tp-flip .tp-tooltip::after { top: auto; bottom: 100%; border: 0;
  border-left: 1px solid #574080; border-top: 1px solid #574080;
  transform: translate(-50%, 5px) rotate(45deg); }
.tp-badge:hover .tp-tooltip, .tp-badge:focus-visible .tp-tooltip {
  opacity: 1; visibility: visible; transform: translate(-50%, 0); }
.tp-tooltip-heading { display: flex; align-items: center; gap: 7px;
  font: 800 13px/1.4 Inter, system-ui, sans-serif; white-space: nowrap; }
.tp-mini-logo { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px;
  background: #4f1ff0; color: #fff; font-size: 9px; letter-spacing: -1px; }
.tp-check { color: #c5ff77; }
.tp-tooltip-sub { color: #b1a4ce; font: 400 11px/1.4 Inter, system-ui, sans-serif; white-space: nowrap; }
@keyframes tp-orbit { to { transform: rotate(360deg); } }
@keyframes tp-reverse { to { transform: rotate(-360deg); } }
@keyframes tp-pulse { 50% { box-shadow: 0 0 16px #8e5aff, 0 0 30px #642cff99; } }
@keyframes tp-glow { 50% { opacity: .45; transform: scale(1.3); } }
@keyframes tp-sweep { 0%, 20% { left: -40%; opacity: 0; } 35% { opacity: 1; } 65%, 100% { left: 120%; opacity: 0; } }
@keyframes tp-glow-inner { 50% { opacity: .5; } }
@keyframes tp-pulse-inner { 50% { box-shadow: 0 0 7px #8e5aff; } }
@keyframes tp-spark { 50% { transform: scale(1.7); opacity: .5; } }
@media (prefers-reduced-motion: reduce) {
  .tp-aura, .tp-logo, .tp-ring, .tp-sweep, .tp-spark, .tp-static .tp-aura, .tp-static .tp-logo { animation: none; }
  .tp-logo, .tp-tooltip { transition: none; }
}

@media (prefers-color-scheme: dark) {
  .bar { background: #1c1730; color: #ece6ff; border-color: #4b3d86; }
  .bar .meta { color: #b3a8d9; }
  .bar.unrouted { background: #1a1d24; color: #c9ceda; border-color: #343a46; }
  .drawer, .card { background: #151221; color: #ece6ff; border-color: #3b3168; }
  .section { border-color: #2a2445; }
  .finding, .stat { background: #1e1a30; border-color: #2f2850; }
  .row span:first-child, .note, .stat small { color: #a79fc7; }
  .btn.secondary { color: #cfc2ff; border-color: #5a4aa3; }
}
`;
