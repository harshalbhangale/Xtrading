"use client";
import { identityStatusSchema, type PostSignal } from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bridge as readFollowing } from "./browser-following";
import {
  extensionWatchlist,
  readLocalHandles,
  storageKey,
} from "./dashboard/watchlist";

type Item = {
  signal: PostSignal;
  trade: { buy: string | null; sell: string | null };
  registered: {
    callId: string | null;
    asset: string;
    direction: "up" | "down";
    start: number;
    expiry: number;
    outcome: "success" | "failure" | "tie" | null;
    returnBps: string | null;
  } | null;
  removed: boolean;
  ageMs: number;
};
type Sidebar = {
  trending: { asset: string; calls: number; bias: string }[] | null;
  integrity: {
    indexed: number;
    callsDetected: number;
    registered: number;
    scored: number;
  } | null;
  rail:
    | {
        handle: string;
        scored: number;
        hits: number;
        medianBps: number | null;
        tier: string | null;
        flags: number;
        source?: "registered" | "detected";
        verdict: "follow" | "fade" | "neutral" | "unscored";
      }[]
    | null;
};
type Filter = "all" | "calls" | "high";

const POLL_MS = 15_000;
const fadesKey = "cmb.fades.v1";
const age = (ms: number) =>
  ms < 3_600_000
    ? `${Math.max(1, Math.round(ms / 60_000))}m`
    : ms < 86_400_000
      ? `${Math.round(ms / 3_600_000)}h`
      : `${Math.round(ms / 86_400_000)}d`;
const pct = (bps: number) =>
  `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${Math.abs(bps / 100).toFixed(1)}%`;
function readFades(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(fadesKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((h): h is string => typeof h === "string").slice(0, 200)
      : [];
  } catch {
    return [];
  }
}

function Resolution({ item }: { item: Item }) {
  const call = item.registered;
  if (!call)
    return (
      <p className="term-resolution muted">
        <i /> Detected · not registered by the creator · unscored
      </p>
    );
  if (call.outcome)
    return (
      <p className={`term-resolution term-${call.outcome}`}>
        <i /> Resolved:{" "}
        {call.outcome === "success"
          ? "correct"
          : call.outcome === "failure"
            ? "wrong"
            : "flat"}
        {call.returnBps && ` ${pct(Number(call.returnBps))}`}
      </p>
    );
  const span = Math.max(1, call.expiry - call.start);
  const done = Math.min(1, Math.max(0, (Date.now() - call.start) / span));
  const left = Math.max(0, call.expiry - Date.now());
  return (
    <div className="term-resolution">
      <span>
        <i /> Resolution
      </span>
      <div
        className="tier-bar"
        role="progressbar"
        aria-valuenow={Math.round(done * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Time to expiry"
      >
        <span style={{ width: `${done * 100}%` }} />
      </div>
      <strong>{left ? `${age(left)} left` : "awaiting price"}</strong>
    </div>
  );
}

/** Live call feed from followed creators, with follow/fade and trending tickers. */
export default function ConfiguredTerminal() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [followed, setFollowed] = useState<string[] | null>(null);
  const [fades, setFades] = useState<string[]>([]);
  const [source, setSource] = useState<"following" | "everyone">("following");
  const [filter, setFilter] = useState<Filter>("calls");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [status, setStatus] = useState<"live" | "error">("live");
  const [sidebar, setSidebar] = useState<Sidebar | null>(null);
  const [notice, setNotice] = useState("");
  const [checks, setChecks] = useState<Record<string, string>>({});

  // Followed creators: saved watchlist (extension or this browser) plus follows observed on X.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setFades(readFades());
    (async () => {
      const handles = new Set<string>();
      try {
        const saved = await extensionWatchlist({ action: "read" });
        for (const e of saved.entries) handles.add(e.handle);
      } catch {
        try {
          for (const h of readLocalHandles()) handles.add(h);
        } catch {}
      }
      if (authenticated) {
        try {
          const token = await getAccessToken();
          const identity = identityStatusSchema.parse(
            await (
              await fetch("/api/identity", {
                cache: "no-store",
                headers: { Authorization: `Bearer ${token}` },
              })
            ).json(),
          );
          const viewer = identity.xAccount?.handle;
          if (viewer)
            for (const f of (await readFollowing(viewer)).follows)
              handles.add(f.handle);
        } catch {
          // Observed follows need the extension; saved handles still work.
        }
      }
      if (cancelled) return;
      setFollowed([...handles]);
      if (!handles.size) setSource("everyone");
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  const load = useCallback(async () => {
    if (followed === null) return;
    const params = new URLSearchParams({ filter });
    if (q.trim()) params.set("q", q.trim());
    if (source === "following") params.set("handles", followed.join(","));
    try {
      const response = await fetch(`/api/terminal/feed?${params}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as { items: Item[] };
      setItems(body.items);
      setStatus("live");
    } catch {
      setStatus("error");
    }
  }, [followed, filter, q, source]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const railHandles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items ?? [])
      counts.set(item.signal.handle, (counts.get(item.signal.handle) ?? 0) + 1);
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([h]) => h)
      .sort()
      .join(",");
  }, [items]);
  useEffect(() => {
    let cancelled = false;
    const fetchSidebar = () =>
      fetch(`/api/terminal/sidebar?handles=${railHandles}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? (r.json() as Promise<Sidebar>) : null))
        .then((value) => {
          if (!cancelled && value) setSidebar(value);
        })
        .catch(() => undefined);
    void fetchSidebar();
    const timer = setInterval(fetchSidebar, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [railHandles]);

  async function follow(handle: string) {
    if (followed?.includes(handle)) return;
    try {
      await extensionWatchlist({ action: "add", handle });
    } catch {
      try {
        const next = [...new Set([...readLocalHandles(), handle])].slice(0, 50);
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    }
    setFollowed((current) => [...new Set([...(current ?? []), handle])]);
    setNotice(`Following @${handle}.`);
  }
  function fade(handle: string) {
    const next = fades.includes(handle)
      ? fades.filter((h) => h !== handle)
      : [...fades, handle];
    setFades(next);
    try {
      localStorage.setItem(fadesKey, JSON.stringify(next));
    } catch {}
  }
  async function reportDeleted(postId: string) {
    setChecks((c) => ({ ...c, [postId]: "Checking X…" }));
    try {
      const r = await fetch(`/api/posts/${postId}/availability`, {
        cache: "no-store",
      });
      const body = (await r.json()) as { status?: string };
      setChecks((c) => ({
        ...c,
        [postId]:
          body.status === "available"
            ? "Still public on X"
            : body.status === "not-publicly-available"
              ? "Not public on X right now (deleted, protected or suspended)"
              : "X could not be reached; try later",
      }));
    } catch {
      setChecks((c) => ({ ...c, [postId]: "Check unavailable" }));
    }
  }

  return (
    <div className="terminal">
      <aside className="term-left">
        <p className="term-live" data-status={status}>
          <i /> {status === "live" ? "Live · polls every 15s" : "Reconnecting…"}
        </p>
        <label className="term-label" htmlFor="term-search">
          Search feed
        </label>
        <input
          id="term-search"
          className="term-input"
          placeholder="handle, $ticker, text"
          maxLength={40}
          value={q}
          onChange={(e) => setQ(e.target.value.replace(/[^\w$@ .-]/g, ""))}
        />
        <p className="term-label">Source</p>
        <div className="term-options">
          <button
            type="button"
            aria-pressed={source === "following"}
            disabled={!followed?.length}
            onClick={() => setSource("following")}
          >
            Following{followed ? ` · ${followed.length}` : ""}
          </button>
          <button
            type="button"
            aria-pressed={source === "everyone"}
            onClick={() => setSource("everyone")}
          >
            Everyone
          </button>
        </div>
        <p className="term-label">Filter</p>
        <div className="term-options">
          {(
            [
              ["all", "All posts"],
              ["calls", "Calls only"],
              ["high", "High conviction"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {sidebar?.integrity && (
          <dl className="term-integrity">
            <dt>Posts indexed</dt>
            <dd>{sidebar.integrity.indexed}</dd>
            <dt>Calls detected</dt>
            <dd>{sidebar.integrity.callsDetected}</dd>
            <dt>Registered calls</dt>
            <dd>{sidebar.integrity.registered}</dd>
            <dt>Scored</dt>
            <dd>{sidebar.integrity.scored}</dd>
          </dl>
        )}
        {followed !== null && followed.length === 0 && (
          <p className="small-note">
            Follow creators here, save them from X profiles with the extension,
            or turn on following sync on the{" "}
            <Link className="text-link" href="/dashboard/watchlist">
              Watchlist
            </Link>
            .
          </p>
        )}
      </aside>

      <section className="term-feed" aria-live="polite">
        <div className="term-feed-head">
          <strong>
            {source === "following" ? "Following" : "Everyone"} ·{" "}
            {filter === "all"
              ? "all posts"
              : filter === "high"
                ? "high conviction"
                : "calls"}
          </strong>
          <span>{items ? `${items.length} posts` : "Loading…"}</span>
        </div>
        {notice && <p className="small-note">{notice}</p>}
        {items?.length === 0 && (
          <div className="dashboard-empty">
            <h3>Nothing here yet.</h3>
            <p>
              Posts appear as extension users see them on X. Try “Everyone” or
              “All posts”.
            </p>
          </div>
        )}
        {items?.map((item) => {
          const s = item.signal;
          const faded = fades.includes(s.handle);
          const isFollowed = followed?.includes(s.handle);
          return (
            <article
              key={s.postId}
              className="term-card"
              data-faded={faded || undefined}
            >
              <header>
                <span className="term-avatar" aria-hidden="true">
                  {s.handle.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <Link href={`/creators/${s.handle}`}>@{s.handle}</Link>
                  <span> · {age(item.ageMs)}</span>
                  {faded && <span className="term-fading"> · fading</span>}
                </div>
                <nav>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => void reportDeleted(s.postId)}
                  >
                    ⚑ Report deleted
                  </button>
                  <a
                    className="text-link"
                    href={`https://x.com/${s.handle}/status/${s.postId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Original ↗
                  </a>
                </nav>
              </header>
              {item.removed && (
                <p className="term-removed">
                  This registered call is no longer public on X.
                </p>
              )}
              <p className="term-text">{s.summary || "(no text)"}</p>
              <div className="term-chips">
                {s.instrument && <span>{s.instrument.toUpperCase()}</span>}
                {s.asset && (
                  <span
                    className={
                      s.direction === "bullish"
                        ? "up"
                        : s.direction === "bearish"
                          ? "down"
                          : ""
                    }
                  >
                    ${s.asset}{" "}
                    {s.direction === "bullish"
                      ? "▲ long"
                      : s.direction === "bearish"
                        ? "▼ short"
                        : ""}
                    {s.leverage ? ` · ${s.leverage}x` : ""}
                  </span>
                )}
                <span>{s.confidence} confidence</span>
                {!s.isCall && <span>not a call</span>}
              </div>
              <Resolution item={item} />
              {checks[s.postId] && (
                <p className="small-note">{checks[s.postId]}</p>
              )}
              <footer>
                <div className="term-vote">
                  <button
                    type="button"
                    aria-pressed={Boolean(isFollowed)}
                    onClick={() => void follow(s.handle)}
                  >
                    ▲ {isFollowed ? "Following" : "Follow"}
                  </button>
                  <button
                    type="button"
                    aria-pressed={faded}
                    onClick={() => fade(s.handle)}
                  >
                    ▼ {faded ? "Fading" : "Fade"}
                  </button>
                </div>
                {item.trade.buy && (
                  <Link className="button" href={item.trade.buy}>
                    Trade ${s.asset}
                  </Link>
                )}
              </footer>
            </article>
          );
        })}
      </section>

      <aside className="term-right">
        <section>
          <p className="term-label">Who to follow or fade</p>
          {!sidebar?.rail?.length ? (
            <p className="small-note">
              Verdicts appear for creators in this feed with scored calls.
            </p>
          ) : (
            <ul className="term-rail">
              {sidebar.rail.map((r) => (
                <li key={r.handle}>
                  <Link href={`/creators/${r.handle}`}>@{r.handle}</Link>
                  <span className={`term-verdict term-${r.verdict}`}>
                    {r.verdict === "unscored"
                      ? "unscored"
                      : r.medianBps !== null
                        ? pct(r.medianBps)
                        : "—"}
                  </span>
                  <small>
                    {r.scored
                      ? `${r.hits}/${r.scored} right · ${r.verdict}${r.source === "detected" ? " · detected, since post" : ""}`
                      : "no scored calls"}
                    {r.flags ? ` · ⚑ ${r.flags}` : ""}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <p className="term-label">Trending tickers · 7d</p>
          {!sidebar?.trending?.length ? (
            <p className="small-note">No calls detected this week.</p>
          ) : (
            <ol className="term-trending">
              {sidebar.trending.map((t) => (
                <li key={t.asset}>
                  <strong>${t.asset}</strong>
                  <span className={`term-bias term-${t.bias}`}>{t.bias}</span>
                  <small>
                    {t.calls} {t.calls === 1 ? "call" : "calls"}
                  </small>
                </li>
              ))}
            </ol>
          )}
        </section>
        <p className="small-note">
          Follow/fade uses the median move of a creator&apos;s registered calls,
          or, when they have none, of calls detected in their posts priced from
          the minute they were posted. Only registered calls count toward tiers.
        </p>
      </aside>
    </div>
  );
}
