// Scoped to shadow roots so X's styles never leak in and ours never leak out.
export const css = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: inherit; }
.badge { display: inline-flex; gap: 4px; margin-left: 6px; vertical-align: middle; }
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
