import Link from "next/link";
import { demoKol } from "../lib/demo-kol";
import { PageHeading, Panel } from "./dashboard/ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
const hours = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 3_600_000);
const pct = (value: number) => `${value > 0 ? "+" : "−"}${Math.abs(value)}%`;

/** Fictional red-flag creator for demos; every section is marked as sample data. */
export function DemoKolCase() {
  const k = demoKol;
  const blocked = k.tokens.filter((t) => t.nansen === "blocked").length;
  return (
    <>
      <Link className="back-link" href="/creators">
        ← All creators
      </Link>
      <p className="demo-banner">
        Demo data · fictional account. Posts, token addresses and Nansen
        verdicts on this page are made up to show how red flags appear.
      </p>
      <PageHeading
        eyebrow="Creator record"
        title={`@${k.handle}`}
        description={k.summary}
      />

      <div className="demo-kol-stats">
        <div>
          <span>Verdict</span>
          <strong className="demo-bad">{k.verdict}</strong>
        </div>
        <div>
          <span>Calls right</span>
          <strong>
            {k.record.right}/{k.record.scored}
          </strong>
        </div>
        <div>
          <span>Median since post</span>
          <strong className="demo-bad">{pct(k.record.medianPct)}</strong>
        </div>
        <div>
          <span>Nansen-blocked tokens</span>
          <strong className="demo-bad">
            {blocked}/{k.tokens.length}
          </strong>
        </div>
        <div>
          <span>Deleted calls</span>
          <strong className="demo-bad">{k.deleted.length}</strong>
        </div>
      </div>

      <Panel title="Red flags">
        <ul className="kol-flags">
          {k.flags.map((flag) => (
            <li key={flag.title} data-severity={flag.severity}>
              <div>
                <span className="flag-severity">
                  {flag.severity === "serious" ? "Red flag" : "Warning"}
                </span>
                <strong>{flag.title}</strong>
              </div>
              <p>{flag.detail}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Tokens shilled · Nansen screening"
        description="Contract addresses this account posted, as screened by Nansen."
      >
        <ul className="demo-tokens">
          {k.tokens.map((t) => (
            <li key={t.address}>
              <header>
                <div>
                  <strong>${t.symbol}</strong>
                  <span>{t.name}</span>
                </div>
                <span className={`demo-verdict demo-${t.nansen}`}>
                  {t.nansen === "blocked" ? "⛔ Nansen blocked" : "⚠ Warning"}
                </span>
              </header>
              <code>{t.address}</code>
              <blockquote>“{t.claim}”</blockquote>
              <ul>
                {t.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <footer>
                <span>Posted {when(t.postedAt)} UTC</span>
                <span className="demo-bad">
                  {pct(t.sincePostPct)} since post
                </span>
              </footer>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="Deleted calls"
        description="Posts captured when they went live and later removed from X."
      >
        <ul className="demo-deleted">
          {k.deleted.map((post) => (
            <li key={post.postedAt}>
              <p>{post.text}</p>
              <footer>
                <span>
                  Posted {when(post.postedAt)} · deleted{" "}
                  {hours(post.postedAt, post.deletedAt)}h later
                </span>
                <span className="demo-bad">
                  ${post.asset} {pct(post.moveBeforeDeletePct)} before deletion
                </span>
              </footer>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
