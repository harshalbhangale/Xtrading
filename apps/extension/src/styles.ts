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
.metric { display: flex; flex-direction: column; gap: 1px; padding: 5px 0; }
.metric-label { color: #6b6585; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.metric-value { font-weight: 650; overflow-wrap: anywhere; }
.metric.contradiction .metric-value { color: #b3261e; }
.metric.consistent .metric-value { color: #1d6b2a; }
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

/* Match X's page theme rather than the operating system's preference. */
:host { --surface: #fff; --foreground: #0f1419; --line: #cfd9de; --muted: #536471; --raised: #f7f9f9; }
:host([data-theme="dark"]) { --surface: #000; --foreground: #e7e9ea; --line: #2f3336; --muted: #71767b; --raised: #16181c; }
.bar, .bar.unrouted, .drawer, .card { background: var(--surface); color: var(--foreground); border-color: var(--line); }
.bar { padding: 8px 10px; border-radius: 8px; }
.bar .meta, .note, .row span:first-child, .section h3, .stat small { color: var(--muted); }
.drawer header { background: var(--surface); color: var(--foreground); border-bottom: 1px solid var(--line); }
.drawer header button { color: var(--foreground); }
.section, .finding, .stat { border-color: var(--line); }
.finding, .stat { background: var(--raised); }
.btn.secondary { color: var(--foreground); border-color: var(--line); }
.network-switch { display: flex; gap: 8px; }
.network-switch [aria-pressed="true"] { background: #e7e9ea; color: #0f1419; border-color: #e7e9ea; }
.evidence-details summary { cursor: pointer; padding: 14px 16px; font-weight: 600; }
/* Profile card: quiet module above the tabs, two matched actions. */
.card { margin: 8px 16px 12px; }
.card .title { font: 700 14px system-ui; margin-bottom: 8px; }
.card-actions { display: flex; flex-wrap: nowrap; align-items: center; justify-content: flex-start; gap: 8px; margin-top: 12px; }
.card-actions .cta, .card-toggle { display: inline-flex; flex: 1 1 0; align-items: center; justify-content: center;
  box-sizing: border-box; max-width: 11.5rem; min-width: 0; min-height: 32px; margin: 0; padding: 0 12px;
  border-radius: 999px; font: 700 12px/1 system-ui, sans-serif; white-space: nowrap; text-align: center; }
.card-actions .cta { background: #d6f58a; color: #17210c; }
.card-actions .cta:hover { background: #e7fea8; }
.card-toggle { appearance: none; cursor: pointer; background: transparent; color: var(--foreground); border: 1px solid var(--line); }
.card-toggle:hover { background: var(--raised); }
.card-toggle::after { content: " ▾"; }
.card-toggle[aria-expanded="true"]::after { content: " ▴"; }
.card-toggle:focus-visible { outline: 2px solid #7b61ff; outline-offset: 2px; }
.card-overview { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
.card-overview h3 { margin: 14px 0 4px; color: var(--muted); font: 700 11px/1.3 system-ui;
  letter-spacing: .06em; text-transform: uppercase; }
.card-overview .note { margin-top: 4px; }
.metric-label { color: var(--muted); }
.metrics { display: flex; flex-direction: column; gap: 8px; }
.metric-group { margin-top: 6px; color: var(--muted); font: 700 10px/1 system-ui; letter-spacing: .08em; text-transform: uppercase; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(84px, 1fr)); gap: 8px; }
.stat-tile { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px;
  background: var(--raised); border: 1px solid var(--line); min-width: 0; }
.stat-value { font: 750 20px/1.15 system-ui; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.stat-value a { color: inherit; text-decoration: none; }
.stat-label { color: var(--muted); font: 600 11px/1.2 system-ui; }
.stat-tile.bad .stat-value { color: #f4695f; }
.stat-tile.good .stat-value { color: #4cc26a; }
.box-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.metric-box { display: flex; flex-direction: column; gap: 3px; min-width: 0; padding: 10px 12px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--raised); }
.metric-box.wide { grid-column: 1 / -1; }
.metric-box .metric-label { font: 700 10px/1.2 system-ui; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.metric-box .metric-value { font: 650 14px/1.3 system-ui; overflow-wrap: anywhere; }
.metric-box.bad { border-color: #b3261e; }
.metric-box.bad .metric-value { color: #f4695f; }
.metric-box.good .metric-value { color: #4cc26a; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.pill-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px;
  background: var(--raised); border: 1px solid var(--line); font: 600 12px/1.3 system-ui; }
.pill-chip a { color: inherit; }
.pill-chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); }
.pill-chip.good .dot { background: #4cc26a; }
.pill-chip.bad { border-color: #b3261e; }
.pill-chip.bad .dot { background: #f4695f; }
.pill-chip:not(.good):not(.bad) .dot { background: #c7ff72; }
.metric-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 2px; font-size: 13px;
  border-bottom: 1px solid var(--line); }
.metric-row-label { color: var(--muted); }
.unavailable { margin-top: 2px; }
.unavailable summary { cursor: pointer; display: block; text-align: center; padding: 8px 10px; border-radius: 10px;
  border: 1px dashed var(--line); color: var(--muted); font: 600 11px/1.3 system-ui; list-style: none; }
.unavailable summary::-webkit-details-marker { display: none; }
.unavailable summary::after { content: " ▾"; }
.unavailable[open] summary::after { content: " ▴"; }
.unavailable-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 2px; font-size: 12px; color: var(--muted); }
.unavailable-row span:first-child { color: var(--foreground); font-weight: 600; }
.metric.empty .metric-value { color: var(--muted); }
.metric-reason { margin-left: 8px; font-size: 12px; font-weight: 400; }
.feed-actions { flex-basis: 100%; }
.feed-actions summary { cursor: pointer; font-weight: 600; }
.feed-actions-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 8px; }
.btn[disabled] { background: transparent; color: var(--muted); border: 1px dashed var(--line); cursor: not-allowed; }
.card-overview .finding .bar { gap: 10px; }
/* Perp ticket in the drawer */
.ticket { display: flex; flex-direction: column; gap: 10px; }
.ticket-head { display: flex; align-items: baseline; gap: 10px; }
.ticket-head strong { font-size: 15px; }
.ticket-mark { font: 700 18px/1 ui-monospace, monospace; }
.ticket-head .up { color: #2fbf71; font-weight: 600; font-size: 12px; }
.ticket-head .down { color: #f2566b; font-weight: 600; font-size: 12px; }
.ticket-side { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; padding: 3px; border-radius: 8px; border: 1px solid var(--line); background: var(--raised); }
.ticket-side .side { padding: 8px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font: 700 13px system-ui; cursor: pointer; }
.ticket-side .long[aria-pressed="true"] { background: #2fbf71; color: #04140a; }
.ticket-side .short[aria-pressed="true"] { background: #f2566b; color: #1a0508; }
.ticket-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ticket-row > span, .ticket-size > span { color: var(--muted); font-size: 12px; }
.ticket-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.ticket-chips button { padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); background: transparent;
  color: var(--foreground); font: 600 11px ui-monospace, monospace; cursor: pointer; }
.ticket-chips button[aria-pressed="true"] { border-color: #c7ff72; color: #c7ff72; }
.pct-row { justify-content: flex-end; }
.ticket-size { display: flex; align-items: center; gap: 8px; padding: 2px 4px 2px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--raised); }
.ticket-size input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--foreground); text-align: right;
  font: 600 16px ui-monospace, monospace; padding: 8px 0; outline: none; }
.ticket-size .unit { border: 0; background: transparent; color: var(--foreground); font: 600 12px system-ui; cursor: pointer; padding: 6px; white-space: nowrap; }
.ticket-hint { margin: -4px 0 0; min-height: 14px; text-align: right; color: var(--muted); font-size: 11px; }
.ticket-hint.error { color: #f2566b; }
.ticket-sum { display: flex; flex-direction: column; gap: 4px; margin: 0; font-size: 12px; }
.ticket-sum div { display: flex; justify-content: space-between; }
.ticket-sum dt { color: var(--muted); text-decoration: underline dotted; text-underline-offset: 3px; }
.ticket-sum dd { margin: 0; font-family: ui-monospace, monospace; }
.ticket-go { display: block; padding: 11px; border-radius: 8px; text-align: center; text-decoration: none; font: 700 14px system-ui; }
.ticket-go.long { background: #2fbf71; color: #04140a; }
.ticket-go.short { background: #f2566b; color: #1a0508; }
.ticket-go { width: 100%; border: 0; cursor: pointer; }
.ticket-go[hidden], .ticket-link[hidden] { display: none; }
.ticket-panel { display: flex; flex-direction: column; gap: 6px; }
.ticket-panel:empty { display: none; }
.ticket-mode { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.4; }
.ticket-mode strong { color: var(--foreground); }
.ticket-mode.rejected strong { color: #f2566b; }
.ticket-mode.submitted strong { color: #2fbf71; }
.ticket-confirm { display: flex; gap: 6px; }
.ticket-confirm .ticket-go { flex: 1; }
.ticket-back { padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--foreground); font: 600 13px system-ui; cursor: pointer; }
.ticket-venue { margin-left: auto; color: var(--muted); font: 600 11px ui-monospace, monospace; }
.ticket-size .unit { cursor: default; }
.ticket-link { border: 0; background: none; padding: 2px 0; color: var(--muted); font: 600 12px system-ui; text-decoration: underline; cursor: pointer; text-align: left; }
.ticket-go.disabled { background: var(--raised); color: var(--muted); border: 1px solid var(--line); pointer-events: none; }
@media (max-width: 720px) {
  .drawer { top: auto; bottom: 0; width: 100vw; height: 88dvh; border: 1px solid var(--line); border-radius: 18px 18px 0 0; }
}

/* ── Xtrading brand theme: same palette as the website, on every X theme. ── */
:host, :host([data-theme="dark"]) {
  --paper: #050605; --surface: #0d110f; --raised: #131815; --hover: #19201b;
  --foreground: #e6ebe3; --soft: #b8c2b7; --muted: #8b978d; --line: #1e2621; --line-strong: #2c3830;
  --lime: #c6f25a; --on-lime: #0e1407; --positive: #8ad97c; --negative: #ff8a7a; --warning: #f0c766;
}
* { font-family: Inter, "SF Pro Text", system-ui, -apple-system, "Segoe UI", sans-serif; }
.bar, .bar.unrouted, .drawer, .card { background: var(--surface); color: var(--foreground); border-color: var(--line); }
.bar { border-radius: 12px; padding: 10px 12px; }
.bar .label { color: var(--foreground); }
.bar .meta, .note, .row span:first-child, .section h3, .stat small, .metric-label { color: var(--muted); }
.btn { background: var(--lime); color: var(--on-lime); border-radius: 8px; }
.btn:hover { background: #d6f985; }
.btn.secondary, .btn[disabled] { background: transparent; color: var(--soft); border: 1px solid var(--line-strong); }
.btn:focus-visible, .chip:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--lime); outline-offset: 2px; }
.chip.staked { color: var(--lime); background: #c6f25a14; border-color: #c6f25a55; }
.chip.verified { color: var(--positive); background: #8ad97c14; border-color: #8ad97c55; }
.dir-bullish { color: var(--positive); } .dir-bearish { color: var(--negative); }
.cta { background: var(--lime); color: var(--on-lime); border-radius: 10px; }
.finding, .stat, .metric-box, .stat-tile, .pill-chip { background: var(--raised); border-color: var(--line); }
.metric-box.bad, .pill-chip.bad { border-color: #ff8a7a66; }
.metric-box.bad .metric-value, .stat-tile.bad .stat-value { color: var(--negative); }
.metric-box.good .metric-value, .stat-tile.good .stat-value { color: var(--positive); }
.card-toggle { border-color: var(--line-strong); color: var(--foreground); }
.card-toggle:hover { background: var(--hover); }
.tag { background: #f0c76614; color: var(--warning); border-color: #f0c76655; }

/* Drawer */
.drawer { width: min(420px, 100vw); border-left: 1px solid var(--line); box-shadow: -24px 0 60px #000a; font-size: 13px; }
.drawer header { padding: 14px 16px; background: var(--surface); border-bottom: 1px solid var(--line); z-index: 2; }
.brand { display: flex; align-items: center; gap: 10px; }
.brand-mark { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px;
  background: var(--raised); border: 1px solid var(--line-strong); color: var(--lime); }
.brand-mark svg { width: 20px; height: 20px; }
.brand strong { display: block; font-size: 15px; letter-spacing: -0.01em; }
.brand small { display: block; color: var(--muted); font-size: 12px; }
.drawer header button { width: 32px; height: 32px; border-radius: 8px; color: var(--soft); }
.drawer header button:hover { background: var(--hover); color: var(--foreground); }
.section { padding: 16px; border-color: var(--line); }
.section h3 { color: var(--lime); font: 700 10px/1 ui-monospace, "SF Mono", monospace; letter-spacing: .12em; margin-bottom: 12px; }
.section.network { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; }
.section.network .note { margin: 0; font-size: 11px; flex: 1; min-width: 160px; }
.network-switch { display: inline-flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--paper); border: 1px solid var(--line); }
.seg { border: 0; border-radius: 6px; padding: 4px 10px; background: transparent; color: var(--muted); font: 600 12px Inter, system-ui; cursor: pointer; }
.seg[aria-pressed="true"] { background: var(--raised); color: var(--foreground); box-shadow: inset 0 0 0 1px var(--line-strong); }
.network-switch [aria-pressed="true"] { border-color: transparent; }
.row { padding: 5px 0; }
.pill.consistent { background: #8ad97c1a; color: var(--positive); }
.pill.contradiction { background: #ff8a7a1a; color: var(--negative); }
.pill.neutral { background: var(--raised); color: var(--soft); }

/* Ticket */
.ticket { gap: 12px; }
.ticket-head { align-items: center; }
.ticket-head strong { font-size: 13px; padding: 3px 8px; border-radius: 6px; background: var(--raised); border: 1px solid var(--line); }
.ticket-mark { font: 700 22px/1 ui-monospace, "SF Mono", monospace; letter-spacing: -0.02em; }
.ticket-head .up { color: var(--positive); } .ticket-head .down { color: var(--negative); }
.ticket-side { background: var(--paper); border-color: var(--line); border-radius: 10px; padding: 3px; }
.ticket-side .side { padding: 10px; border-radius: 8px; font-size: 14px; }
.ticket-side .side:hover { color: var(--foreground); }
.ticket-side .long[aria-pressed="true"] { background: var(--positive); color: #08160a; }
.ticket-side .short[aria-pressed="true"] { background: var(--negative); color: #1c0806; }
.ticket-chips button { border-color: var(--line-strong); color: var(--soft); padding: 4px 10px; border-radius: 7px; }
.ticket-chips button:hover { color: var(--foreground); border-color: var(--muted); }
.ticket-chips button[aria-pressed="true"] { border-color: var(--lime); color: var(--lime); background: #c6f25a12; }
.ticket-size { background: var(--paper); border-color: var(--line-strong); border-radius: 10px; padding: 4px 6px 4px 14px; }
.ticket-size:focus-within { border-color: var(--lime); }
.ticket-size input { font-size: 18px; }
.ticket-size .unit { color: var(--soft); }
.ticket-sum { padding: 10px 12px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line); gap: 6px; }
.ticket-sum dt { color: var(--muted); text-decoration-color: var(--line-strong); }
.ticket-go { padding: 12px; border-radius: 10px; font-size: 14px; letter-spacing: -0.01em; }
.ticket-go.long { background: var(--positive); color: #08160a; }
.ticket-go.short { background: var(--negative); color: #1c0806; }
.ticket-go.long:hover { filter: brightness(1.06); } .ticket-go.short:hover { filter: brightness(1.06); }
.ticket-go.disabled { background: var(--raised); color: var(--muted); border: 1px dashed var(--line-strong); }
.ticket-hint.error { color: var(--negative); }
.ticket-mode.submitted strong { color: var(--positive); } .ticket-mode.rejected strong { color: var(--negative); }
.ticket-back { border-color: var(--line-strong); color: var(--soft); }
.ticket-link { color: var(--lime); text-decoration: none; }
.ticket-link:hover { text-decoration: underline; }
.ticket-venue { padding: 3px 7px; border-radius: 6px; border: 1px solid var(--line); }
.metric-sub { display: block; margin-top: 4px; color: var(--muted); font: 500 11px/1.4 Inter, system-ui; }
.metric-sub a { color: var(--soft); }
`;
