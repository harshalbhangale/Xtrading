// Scoped to shadow roots so X's styles never leak in and ours never leak out.
export const css = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: inherit; }
.badge { display: inline-flex; gap: 4px; vertical-align: middle; align-items: center; }
.chip { display: inline-flex; align-items: center; gap: 3px; padding: 1px 7px; border-radius: 999px;
  font: 600 11px/18px system-ui; border: 1px solid; white-space: nowrap; cursor: pointer; }
.chip.verified { color: #1d6b2a; background: #e3f6dc; border-color: #9fd38e; }
.chip.tier { color: #1d4f91; background: #e4eefb; border-color: #a9c6ec; font-weight: 700; letter-spacing: 0.04em; }
.chip.tier-ultra { color: #1b1f0a; background: #c6f25a; border-color: #a9d43d; }
.chip.flag { color: #a3241b; background: #fde8e6; border-color: #f2b2ab; font-weight: 700; }
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
.finding.caution { border-left: 3px solid #c77700; }
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
.card-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px; margin-top: 10px; }
.card-actions .cta, .card-toggle, .card-follow { display: inline-flex; flex: 0 1 auto; align-items: center; justify-content: center;
  box-sizing: border-box; max-width: 8.5rem; min-width: 0; min-height: 24px; margin: 0; padding: 0 10px;
  border-radius: 999px; font: 700 11px/1 system-ui, sans-serif; white-space: nowrap; text-align: center; }
.card-actions .cta { background: #d6f58a; color: #17210c; }
.card-actions .cta:hover { background: #e7fea8; }
.card-toggle { appearance: none; cursor: pointer; background: transparent; color: var(--foreground); border: 1px solid var(--line); }
.card-toggle:hover { background: var(--raised); }
.card-toggle::after { content: " ▾"; }
.card-toggle[aria-expanded="true"]::after { content: " ▴"; }
.card-toggle:focus-visible { outline: 2px solid #7b61ff; outline-offset: 2px; }
.card-follow { appearance: none; cursor: pointer; background: transparent; color: var(--foreground); border: 1px solid var(--line); }
.card-follow:hover { background: var(--raised); }
.card-follow[aria-pressed="true"] { background: #d6f58a; color: #17210c; border-color: #d6f58a; }
.card-follow:disabled { opacity: .55; cursor: default; }
.card-follow:focus-visible { outline: 2px solid #7b61ff; outline-offset: 2px; }
.recent-calls { margin-top: 10px; font-size: 12px; }
.recent-calls ul { margin: 6px 0 0; padding-left: 16px; }
.recent-calls li { margin: 3px 0; }
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
.ticket-hint:empty { display: none; }
.ticket .note:empty { display: none; }
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
.ticket-steps { margin: 0; padding-left: 18px; color: var(--foreground); font-size: 12px; line-height: 1.6; }
.ticket-confirm .ticket-go { flex: 1; }
.ticket-back { padding: 0 14px; border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--foreground); font: 600 13px system-ui; cursor: pointer; }
.ticket-venue { margin-left: auto; color: var(--muted); font: 600 11px ui-monospace, monospace; }
.ticket-size .unit { cursor: default; }
.ticket-link { border: 0; background: none; padding: 2px 0; color: var(--muted); font: 600 12px system-ui; text-decoration: underline; cursor: pointer; text-align: left; }
.ticket-go.disabled { background: var(--raised); color: var(--muted); border: 1px solid var(--line); pointer-events: none; }
@media (max-width: 720px) {
  .drawer { top: auto; bottom: 0; width: 100vw; height: 88dvh; border: 1px solid var(--line); border-radius: 18px 18px 0 0; }
}

:host(.cmb-signal-host) { display: block; width: 100%; }
.inline-card { font: 14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color: var(--foreground); background: var(--surface); border: 1px solid var(--line); border-radius: 18px; margin: 12px 0 4px; overflow: hidden; }
.inline-card [hidden] { display: none !important; }
.inline-header { display: flex; align-items: center; gap: 12px; padding: 16px; }
.asset-icon { width: 42px; height: 42px; background: var(--raised); border: 1px solid var(--line); border-radius: 50%; display: grid; place-items: center; font-size: 26px; flex-shrink: 0; }
.inline-asset { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.inline-asset strong { font-size: 17px; }
.inline-price, .inline-note { font-size: 12px; color: var(--muted); margin: 4px 0; }
.inline-card.inline-attached { margin-top: 8px; }
.inline-ticker-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 2px; }
.inline-ticker { display: inline-flex; align-items: baseline; gap: 6px; font-size: 14px; }
.inline-ticker b { font-weight: 700; color: var(--foreground); }
.inline-ticker em { font-style: normal; font-weight: 600; }
.inline-ticker em.up { color: var(--positive); }
.inline-ticker em.down { color: var(--negative); }
.inline-ticker small { font-size: 11px; color: var(--muted); }
.inline-ticker.muted { font-size: 12px; color: var(--muted); }
.inline-spark polyline { stroke: var(--positive); }
.inline-spark.down polyline { stroke: var(--negative); }
.inline-buy,.inline-close { cursor: pointer; border-radius: 99px; padding: 8px 15px; border: 1px solid var(--line); white-space: nowrap; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size: 14px; font-weight: 700; line-height: 1.3; }
.inline-buy { background: var(--foreground); color: var(--surface); }
.inline-close { background: transparent; color: var(--foreground); }
.inline-panel { padding: 16px; border-top: 1px solid var(--line); }
.inline-controls { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.inline-sides { display: flex; border-radius: 99px; border: 1px solid var(--line); padding: 3px; }
.inline-sides button { padding: 7px 16px; cursor: pointer; border: 0; border-radius: 99px; color: var(--muted); background: transparent; font-weight: 700; }
.inline-sides button[aria-pressed="true"] { background: var(--foreground); color: var(--surface); }
.inline-network { border: 1px solid var(--line); background: var(--surface); color: var(--foreground); border-radius: 99px; padding: 8px; font: inherit; font-size: 12px; max-width: 100%; }
.inline-pay,.inline-receive { display: block; border-radius: 16px; border: 1px solid var(--line); padding: 14px; margin-bottom: 8px; background: var(--raised); }
.inline-pay:focus-within { border-color: #1d9bf0; outline: 1px solid #1d9bf0; }
.inline-value { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.inline-amount { border: none; background: transparent; color: var(--foreground); min-width: 0; width: 100%; font-family: inherit; font-weight: 700; line-height: 1.5; outline: none; font-size: 30px; }
.inline-output { font-size: 27px; overflow-wrap: anywhere; }
.inline-symbol { font-size: 17px; font-weight: 700; flex-shrink: 0; }
.inline-submit { width: 100%; border: 0; border-radius: 99px; margin-top: 12px; padding: 14px; background: var(--foreground); color: var(--surface); font-size: 16px; font-weight: 700; cursor: pointer; }
.inline-submit:disabled { opacity: .4; cursor: not-allowed; }
.inline-analytics { padding: 12px 16px; border-top: 1px solid var(--line); }
.inline-analytics summary { cursor: pointer; font-weight: 600; font-size: 12px; }
.inline-evidence { padding-top: 8px; }
.inline-footer { display: flex; justify-content: space-between; gap: 8px; padding: 8px 16px; color: var(--muted); font-size: 11px; }
.inline-fee { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--muted); margin-top: 10px; }
.inline-card a { color: #1d9bf0; }
.inline-card button:focus-visible,.inline-card select:focus-visible,.inline-card summary:focus-visible { outline: 2px solid #1d9bf0; outline-offset: 3px; }

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
.chip.tier { color: var(--lime); background: #c6f25a14; border-color: #c6f25a55; font-weight: 700; letter-spacing: 0.04em; }
.chip.tier-ultra { color: #111; background: var(--lime); border-color: var(--lime); }
.chip.flag { color: #ff8a80; background: #ff5a4f1a; border-color: #ff5a4f66; font-weight: 700; }
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
.brand-mark { border-radius: 9px; }
.powered { display: flex; align-items: center; gap: 6px; margin: 12px 0 0; color: var(--muted); font: 600 11px system-ui, sans-serif; }
.powered-logo { height: 14px; width: auto; filter: invert(1); }
.swap-chain { width: 22px; height: 22px; border-radius: 6px; flex: 0 0 auto; }
.swap-chain-pill { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 99px; padding: 3px 4px 3px 8px; background: var(--raised); }
.swap-chain-pill .swap-network { border: 0; background: transparent; padding: 5px 8px; }
.swap-powered { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border: 1px solid rgba(61, 220, 132, 0.55); border-radius: 99px; background: rgba(61, 220, 132, 0.08); box-shadow: 0 0 0 3px rgba(61, 220, 132, 0.07); font-size: 11px; font-weight: 600; line-height: 1; white-space: nowrap; }
.swap-wordmark { height: 17px; width: auto; filter: invert(1); }
.swap-kuru { height: 13px; width: auto; }
.swap-powered-sep { width: 1px; height: 14px; background: var(--line); }
:host([data-theme="light"]) .swap-wordmark { filter: none; }
:host([data-theme="light"]) .swap-kuru { filter: brightness(0); }
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
/* Spot cards follow X's current theme; other creator/perp surfaces retain their brand theme. */
.inline-card { --surface: #000; --raised: #16181c; --foreground: #e7e9ea; --muted: #71767b; --line: #2f3336; }
:host([data-theme="light"]) .inline-card { --surface: #fff; --raised: #f7f9f9; --foreground: #0f1419; --muted: #536471; --line: #cfd9de; }
.inline-card * { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.inline-buy,.inline-close { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size: 14px; font-weight: 700; line-height: 1.3; }
.swap-card { border-radius: 18px; border: 1px solid var(--line-strong, #3a4046); box-shadow: 0 0 0 1px rgba(214,245,138,.08), 0 10px 30px rgba(0,0,0,.35); }
:host([data-theme="light"]) .swap-card { --line-strong: #aab8c2; box-shadow: 0 6px 22px rgba(15,20,25,.12); }
.swap-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.swap-icon { display: inline-grid; place-items: center; flex: 0 0 auto; border-radius: 50%; color: #fff; font-weight: 700; line-height: 1; }
.swap-title { flex: 0 1 auto; min-width: 0; display: flex; flex-direction: column; }
.swap-title strong { font-size: 17px; }
.swap-title span { color: var(--muted); font-size: 14px; white-space: nowrap; }
.swap-title b { color: var(--foreground); font-weight: 700; }
.swap-title em { font-style: normal; font-weight: 600; }
.swap-title em.up { color: #00ba7c; }
.swap-title em.down { color: #f4212e; }
.swap-spark { flex: 1 1 auto; min-width: 40px; display: flex; justify-content: center; overflow: hidden; }
.swap-spark svg { width: 100%; max-width: 220px; height: 34px; }
.swap-spark polyline { stroke: #00ba7c; stroke-width: 1.6; }
.swap-spark svg.down polyline { stroke: #f4212e; }
.swap-card .inline-panel { border-top: 1px solid var(--line); padding: 14px 16px 12px; display: grid; gap: 8px; }
.swap-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.seg { display: inline-flex; padding: 3px; border: 1px solid var(--line); border-radius: 99px; }
.seg button { border: 0; background: transparent; color: var(--muted); font: 700 14px/1 inherit; padding: 8px 16px; border-radius: 99px; cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--foreground); color: var(--surface); }
.swap-network { border: 1px solid var(--line); border-radius: 99px; background: transparent; color: var(--foreground); padding: 7px 12px; font: 600 13px inherit; }
.swap-box { display: grid; gap: 4px; padding: 12px 14px; border-radius: 14px; background: var(--raised); border: 1px solid transparent; }
.swap-pay { border-color: #1d9bf0; background: transparent; }
.swap-label, .swap-usd { color: var(--muted); font-size: 13px; }
.swap-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.swap-amount { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--foreground); font: 700 28px/1.2 inherit; padding: 0; }
.swap-out { font-size: 28px; font-weight: 700; }
.swap-pill { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px 5px 6px; border: 1px solid var(--line); border-radius: 99px; font-weight: 700; white-space: nowrap; }
.swap-arrow { justify-self: center; margin: -16px 0; z-index: 1; width: 32px; height: 32px; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--foreground); }
.swap-meta { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.swap-creator { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--muted); }
.swap-creator b { color: var(--foreground); }
.swap-submit { margin-top: 6px; }
.swap-footer { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 12px; color: var(--muted); font-size: 12px; padding-top: 12px; margin-top: 4px; border-top: 1px solid var(--line); }
.swap-footer span { display: inline-flex; align-items: center; gap: 6px; }
.swap-footer b { color: var(--foreground); }
.swap-logo { width: 16px; height: 16px; border-radius: 4px; }
.swap-row-end { display: inline-flex; align-items: center; gap: 8px; }
.swap-wallet { border: 1px solid var(--line); border-radius: 99px; padding: 7px 12px; font: 600 13px ui-monospace,SFMono-Regular,Menlo,monospace; }

/* Drawer opened inside a post: same brand surface as the side drawer. Without this the
   panel inherits :host's initial (black, 16px) text. */
.drawer-inline { display: block; margin: 8px 0 4px; overflow: hidden; color: var(--foreground);
  background: var(--surface); border: 1px solid var(--line); border-radius: 16px; font-size: 13px; line-height: 1.5; }
.drawer-inline header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;
  border-bottom: 1px solid var(--line); }
.drawer-inline header button { width: 32px; height: 32px; border: 0; border-radius: 8px; background: none;
  color: var(--soft); font-size: 20px; cursor: pointer; }
.drawer-inline header button:hover { background: var(--hover); color: var(--foreground); }
.drawer-inline .powered { padding: 0 16px 14px; }
.drawer .row span:last-child, .drawer-inline .row span:last-child, .ticket-mark, .ticket-sum dd, .ticket-head strong { color: var(--foreground); }

/* Nansen check panel */
.nansen { display: flex; flex-direction: column; gap: 12px; }
.nansen h3 { display: flex; align-items: center; gap: 8px; margin: 0; }
.nansen .note { margin: 0; }
.nv-net { padding: 2px 6px; border-radius: 5px; border: 1px solid var(--line-strong); color: var(--soft);
  font: 600 9px/1.2 ui-monospace, "SF Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
.nv-hero { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px;
  background: var(--raised); border: 1px solid var(--line); }
.nv-hero.bad { background: linear-gradient(90deg, #ff8a7a14, transparent 70%), var(--raised); border-color: #ff8a7a55; }
.nv-hero.good { background: linear-gradient(90deg, #8ad97c14, transparent 70%), var(--raised); border-color: #8ad97c55; }
.nv-glyph { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 auto; border-radius: 50%;
  font: 800 15px/1 Inter, system-ui; background: var(--hover); color: var(--soft); }
.nv-hero.bad .nv-glyph { background: var(--negative); color: #1c0806; }
.nv-hero.good .nv-glyph { background: var(--positive); color: #08160a; }
.nv-hero-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.nv-hero-text strong { font-size: 15px; letter-spacing: -0.01em; }
.nv-hero-text span { color: var(--muted); font: 500 11px/1.4 ui-monospace, "SF Mono", monospace; overflow-wrap: anywhere; }
.nv-count { flex: 0 0 auto; padding: 3px 8px; border-radius: 99px; background: #f0c76614; color: var(--warning);
  border: 1px solid #f0c76655; font: 700 11px/1.3 Inter, system-ui; }
.nv-block, .nv-group { display: flex; flex-direction: column; gap: 8px; }
.nv-group { padding-top: 12px; border-top: 1px solid var(--line); }
.nv-sub, .nv-label { color: var(--muted); font: 700 10px/1.2 ui-monospace, "SF Mono", monospace; letter-spacing: .08em; text-transform: uppercase; }
.nv-legend { display: flex; gap: 12px; color: var(--muted); font: 500 11px/1 Inter, system-ui; }
.nv-key::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 5px; border-radius: 50%; vertical-align: -1px; }
.nv-key.with::before { background: var(--positive); }
.nv-key.against::before { background: var(--negative); }
.nv-key.perp::before { border-radius: 1px; transform: rotate(45deg); background: var(--soft); }
.nv-timeline { width: 100%; height: auto; display: block; overflow: visible; }
.nv-lane.with { fill: #8ad97c0a; } .nv-lane.against { fill: #ff8a7a0a; }
.nv-axis { stroke: var(--line-strong); stroke-width: 1; }
.nv-post { stroke: var(--lime); stroke-width: 1.5; stroke-dasharray: 3 3; }
.nv-tick { fill: var(--muted); font: 500 9px ui-monospace, "SF Mono", monospace; }
.nv-tick.post { fill: var(--lime); font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
.nv-dot { stroke: var(--surface); stroke-width: 1.5; fill-opacity: .9; }
.nv-dot.with { fill: var(--positive); } .nv-dot.against { fill: var(--negative); }
.nv-dot:hover { fill-opacity: 1; stroke: var(--foreground); }
.nv-list { display: flex; flex-direction: column; gap: 6px; }
.nv-trade, .nv-flag { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 9px;
  background: var(--raised); border: 1px solid var(--line); font-size: 12px; line-height: 1.45; }
.nv-trade { border-left: 3px solid var(--line-strong); }
.nv-trade.with { border-left-color: var(--positive); }
.nv-trade.against { border-left-color: var(--negative); }
.nv-trade > span, .nv-flag > span:last-child { flex: 1; }
.nv-tx { flex: 0 0 auto; color: var(--soft); font-size: 11px; text-decoration: none; }
.nv-tx:hover { color: var(--lime); }
.nv-callout { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 10px;
  background: #ff8a7a12; border: 1px solid #ff8a7a55; font-size: 12px; line-height: 1.45; }
.nv-callout strong { color: var(--negative); font-size: 13px; }
.nv-token-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.nv-symbol { padding: 3px 9px; border-radius: 7px; background: var(--lime); color: var(--on-lime); font: 800 13px/1.2 Inter, system-ui; }
.nv-name { font-weight: 600; }
.nv-chain, .nv-origin { padding: 2px 8px; border-radius: 99px; border: 1px solid var(--line-strong); color: var(--soft); font: 600 11px/1.4 Inter, system-ui; }
.nv-origin { margin-left: auto; border-style: dashed; color: var(--muted); }
.nv-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: 6px; }
.nv-tile { display: flex; flex-direction: column; gap: 2px; padding: 9px 11px; border-radius: 10px; background: var(--raised); border: 1px solid var(--line); min-width: 0; }
.nv-tile b { font: 750 16px/1.2 Inter, system-ui; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.nv-tile span { color: var(--muted); font: 600 10px/1.3 Inter, system-ui; }
.nv-tile.good b { color: var(--positive); } .nv-tile.bad b { color: var(--negative); }
.nv-meter-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; }
.nv-meter { height: 8px; border-radius: 99px; background: var(--paper); border: 1px solid var(--line); overflow: hidden; }
.nv-fill { display: block; height: 100%; border-radius: 99px; }
.nv-fill.good { background: var(--positive); } .nv-fill.warn { background: var(--warning); } .nv-fill.bad { background: var(--negative); }
.nv-pct { font: 700 12px/1 ui-monospace, "SF Mono", monospace; }
.nv-pct.good { color: var(--positive); } .nv-pct.warn { color: var(--warning); } .nv-pct.bad { color: var(--negative); }
.nv-flow { display: grid; grid-template-columns: 92px 1fr 64px; align-items: center; gap: 8px; }
.nv-flow .nv-label { text-transform: none; letter-spacing: 0; font: 500 12px/1.2 Inter, system-ui; color: var(--soft); }
.nv-flow-track { position: relative; height: 10px; border-radius: 3px; background: var(--paper); }
.nv-flow-mid { position: absolute; left: 50%; top: -3px; bottom: -3px; width: 1px; background: var(--line-strong); }
.nv-flow-bar { position: absolute; top: 0; bottom: 0; min-width: 2px; }
.nv-flow-bar.in { background: var(--positive); border-radius: 0 3px 3px 0; }
.nv-flow-bar.out { background: var(--negative); border-radius: 3px 0 0 3px; }
.nv-flow-value { text-align: right; font: 600 11px/1 ui-monospace, "SF Mono", monospace; color: var(--muted); }
.nv-flow-value.in { color: var(--positive); } .nv-flow-value.out { color: var(--negative); }
.nv-seller { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 2px;
  border-bottom: 1px solid var(--line); font-size: 12px; }
.nv-seller:last-child { border-bottom: 0; }
.nv-seller.flagged { background: #ff8a7a0d; padding: 6px 8px; border-radius: 8px; border-bottom: 0; }
.nv-seller-name { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow-wrap: anywhere; }
.nv-seller b { flex: 0 0 auto; color: var(--negative); font: 600 11px ui-monospace, "SF Mono", monospace; }
.nv-badge { padding: 1px 6px; border-radius: 5px; font: 700 9px/1.4 Inter, system-ui; font-style: normal; text-transform: uppercase; letter-spacing: .06em; }
.nv-badge.bad { background: var(--negative); color: #1c0806; }
.nv-badge.warn { background: var(--warning); color: #1f1600; }
.nv-flag-icon { display: grid; place-items: center; width: 16px; height: 16px; flex: 0 0 auto; margin-top: 1px; border-radius: 50%;
  font: 800 10px/1 Inter, system-ui; background: var(--hover); color: var(--soft); }
.nv-flag.caution { border-color: #f0c76655; background: #f0c7660d; }
.nv-flag.caution .nv-flag-icon { background: var(--warning); color: #1f1600; }
.nv-clear { margin: 0; padding: 8px 10px; border-radius: 9px; border: 1px dashed var(--line-strong); color: var(--muted); font-size: 12px; }
.nv-related { display: flex; flex-wrap: wrap; gap: 6px; }
.nv-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 99px;
  background: var(--raised); border: 1px solid var(--line); font: 600 11px/1.3 Inter, system-ui; max-width: 100%; overflow-wrap: anywhere; }
.nv-chip i { font-style: normal; color: var(--muted); font-weight: 500; }
.nv-sources { border-top: 1px solid var(--line); padding-top: 10px; }
.nv-sources summary { display: flex; justify-content: space-between; gap: 8px; cursor: pointer; list-style: none;
  color: var(--soft); font: 600 11px/1.3 Inter, system-ui; }
.nv-sources summary::-webkit-details-marker { display: none; }
.nv-sources summary::after { content: "▾"; color: var(--muted); }
.nv-sources[open] summary::after { content: "▴"; }
.nv-sources-sum { margin-left: auto; color: var(--muted); font-weight: 500; }
.nv-source { display: grid; grid-template-columns: 8px auto auto 1fr; align-items: center; gap: 8px; padding: 5px 0; font-size: 11px; color: var(--muted); }
.nv-source code { color: var(--foreground); font: 600 11px ui-monospace, "SF Mono", monospace; }
.nv-source-status { text-align: right; overflow-wrap: anywhere; }
.nv-status { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); }
.nv-status.ok { background: var(--positive); } .nv-status.empty { background: var(--soft); opacity: .5; }
.nv-status.failed { background: var(--negative); } .nv-status.skipped { background: var(--warning); }

/* Spot and perp cards share X's card style; brand tokens map onto X's theme here. */
.inline-card { --paper: var(--surface); --soft: var(--muted); --hover: var(--raised); --line-strong: var(--line); }
:host([data-theme="light"]) .inline-card { --positive: #00875a; --negative: #d0182a; --warning: #9a6700; }
.call-insights { border-top: 1px solid var(--line); }
.call-insights > summary { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 16px; cursor: pointer;
  list-style: none; font-size: 13px; color: var(--muted); }
.call-insights > summary::-webkit-details-marker { display: none; }
.call-insights > summary::after { content: "▾"; margin-left: auto; }
.call-insights[open] > summary::after { content: "▴"; }
.ci-title { color: var(--foreground); font-weight: 700; }
.ci-chip { padding: 2px 9px; border-radius: 99px; border: 1px solid var(--line); font-size: 12px; font-weight: 600; }
.ci-chip.up { color: var(--positive); border-color: currentColor; }
.ci-chip.down { color: var(--negative); border-color: currentColor; }
.call-insights-body { padding: 0 16px 8px; }
.call-insights-body .section, .call-insights-body .nansen { padding: 12px 0; border-bottom: 1px solid var(--line); }
.call-insights-body .section:last-child { border-bottom: 0; }
.inline-card .section h3 { color: var(--muted); }
.inline-card .row span:last-child { color: var(--foreground); }
.inline-card .note { color: var(--muted); }
.perp-badge { flex: 0 0 auto; padding: 4px 10px; border-radius: 99px; border: 1px solid var(--line); color: var(--muted);
  font-size: 12px; font-weight: 700; white-space: nowrap; }
.perp-venue { color: var(--foreground); font-weight: 800; letter-spacing: -0.01em; }
.perp-card .inline-panel { display: grid; gap: 10px; }
.inline-card .ticket-go { border-radius: 99px; }
.inline-card .ticket-size, .inline-card .ticket-sum { border-radius: 14px; background: var(--raised); }
.inline-card .ticket-side { border-radius: 99px; }
.inline-card .ticket-side .side { border-radius: 99px; }

/* One-line pre-trade verdict from Nansen. */
.risk-line { display: flex; align-items: center; gap: 8px; margin: 0; padding: 9px 12px; border-radius: 12px;
  border: 1px solid var(--line); background: var(--raised); color: var(--foreground); font-size: 13px; font-weight: 600; }
.risk-line > span:nth-child(2) { flex: 1; }
.risk-dot { display: grid; place-items: center; width: 18px; height: 18px; flex: 0 0 auto; border-radius: 50%;
  font: 800 11px/1 system-ui; background: var(--muted); color: var(--surface); }
.risk-line.risky { border-color: var(--negative); }
.risk-line.risky .risk-dot { background: var(--negative); }
.risk-line.clean .risk-dot { background: var(--positive); }
.risk-line.unknown { color: var(--muted); font-weight: 500; }
.risk-link { flex: 0 0 auto; font-size: 12px; font-weight: 600; }

/* One card, two instruments: Spot (Kuru) and Perp (Perpl). */
.trade-pane { display: grid; gap: 8px; }
.trade-pane[hidden] { display: none; }
.trade-modes { justify-self: start; }
.swap-venue { display: inline-flex; align-items: center; }
.perp-card .ticket-head { display: none; }
`;
