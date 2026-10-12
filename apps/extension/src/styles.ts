// Scoped to shadow roots so X's styles never leak in and ours never leak out.
export const css = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: inherit; }
.badge { display: inline-flex; gap: 4px; vertical-align: middle; align-items: center; }
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

/* XTrading verified badge. The host lines up with X's blue tick: centred on the name row, 4px gap. */
:host(.cmb-badge-host), :host(.cmb-profile-badge-host) { display: inline-flex; align-items: center;
  align-self: flex-start; vertical-align: middle; margin-left: 4px; line-height: 0; }
.xt-badge { --xt-lime: #c7ff72; position: relative; display: inline-grid; place-items: center;
  flex-shrink: 0; vertical-align: middle; cursor: pointer; isolation: isolate; outline: none; }
.xt-badge.xt-static { cursor: default; }
.xt-badge:focus-visible { outline: 2px solid var(--xt-lime); outline-offset: 4px; border-radius: 6px; }
.xt-radar { position: absolute; inset: 2%; border: 1px solid #9bc84e; border-radius: 50%; overflow: hidden;
  pointer-events: none; animation: xt-radar-rotate 2.4s linear infinite; }
.xt-radar::after { content: ""; position: absolute; inset: -30%;
  background: conic-gradient(from 0deg, transparent 0deg 265deg, #c7ff7210 300deg, #c7ff7260 335deg, #c7ff72 360deg); }
.xt-corners { position: absolute; inset: 10%; pointer-events: none;
  background:
    linear-gradient(var(--xt-lime), var(--xt-lime)) left top / 7px 1.5px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) left top / 1.5px 7px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) right top / 7px 1.5px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) right top / 1.5px 7px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) left bottom / 7px 1.5px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) left bottom / 1.5px 7px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) right bottom / 7px 1.5px no-repeat,
    linear-gradient(var(--xt-lime), var(--xt-lime)) right bottom / 1.5px 7px no-repeat;
  animation: xt-bracket-pulse 2s ease-in-out infinite; }
.xt-mark { position: relative; z-index: 2; width: 67%; height: 67%; display: grid; place-items: center;
  color: #fff; transition: transform 180ms ease; }
.xt-mark svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 0 3px #ffffff35); }
.xt-badge:hover .xt-mark { transform: scale(1.08); }
.xt-tooltip { position: absolute; bottom: calc(100% + 12px); left: 50%; z-index: 1000; display: flex;
  flex-direction: column; gap: 5px; width: max-content; max-width: min(260px, 80vw); padding: 11px 13px;
  color: #f5f5f5; background: #171717; border: 1px solid #3e4931; border-radius: 9px; box-shadow: 0 8px 28px #0008;
  opacity: 0; visibility: hidden; pointer-events: none; transform: translate(-50%, 5px);
  transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease; }
.xt-tooltip::after { content: ""; position: absolute; top: 100%; left: 50%; width: 8px; height: 8px;
  background: #171717; border-right: 1px solid #3e4931; border-bottom: 1px solid #3e4931;
  transform: translate(-50%, -4px) rotate(45deg); }
/* Flipped when there is no room above, e.g. a profile header near the viewport top. */
.xt-badge.xt-flip .xt-tooltip { bottom: auto; top: calc(100% + 12px); }
.xt-badge.xt-flip .xt-tooltip::after { top: auto; bottom: 100%; border: 0;
  border-left: 1px solid #3e4931; border-top: 1px solid #3e4931; transform: translate(-50%, 4px) rotate(45deg); }
.xt-badge:hover .xt-tooltip, .xt-badge:focus-visible .xt-tooltip {
  opacity: 1; visibility: visible; transform: translate(-50%, 0); }
.xt-tooltip-title { display: flex; align-items: center; gap: 7px; font: 750 12px/1.4 Inter, system-ui, sans-serif;
  white-space: nowrap; }
.xt-tooltip-dot { width: 7px; height: 7px; flex-shrink: 0; border-radius: 50%; background: var(--xt-lime);
  box-shadow: 0 0 7px #c7ff7280; }
.xt-tooltip-sub { color: #a5a5a5; font: 400 10px/1.5 Inter, system-ui, sans-serif; white-space: nowrap; }
@keyframes xt-radar-rotate { to { transform: rotate(360deg); } }
@keyframes xt-bracket-pulse { 0%, 100% { opacity: .7; filter: drop-shadow(0 0 0 transparent); }
  50% { opacity: 1; filter: drop-shadow(0 0 4px #c7ff72aa); } }
@media (prefers-reduced-motion: reduce) {
  .xt-radar, .xt-corners { animation: none; }
  .xt-mark, .xt-tooltip { transition: none; }
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
