"use client";
import {
  identityStatusSchema,
  normalizeHandle,
  type PostSignal,
  type SpotPrice,
  spotPricesSchema,
} from "@call-my-bluff/domain";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { bridge as readFollowing } from "./browser-following";
import {
  extensionWatchlist,
  readLocalHandles,
  storageKey,
} from "./dashboard/watchlist";
import TerminalTradeModal from "./terminal-trade-modal";

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
  /** From a creator the viewer does not follow yet, shown under the followed feed. */
  extra?: boolean;
};
type Attestations = {
  items: {
    id: string;
    kind: "payment";
    network: string;
    transactionHash: string;
    timestamp: number;
    url: string;
    detail: { amount?: string };
  }[];
  sources: { chainId: number; status: string }[];
};
type Deletions = {
  since: string;
  totals: {
    indexed: number;
    checked: number;
    removed: number;
    suspected: number;
  };
  creators: {
    handle: string;
    indexed: number;
    removed: number;
    suspected: number;
  }[];
};
type Sidebar = {
  trending: { asset: string; calls: number; bias: string }[] | null;
  integrity: {
    indexed: number;
    callsDetected: number;
    registered: number;
    scored: number;
    indexer?: {
      testnet: { block: number; time: string | null; ready: boolean } | null;
      mainnet: { block: number; time: string | null; ready: boolean } | null;
    } | null;
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
/** Display price: small values keep significant digits, larger ones two decimals. */
const usd = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n < 1
    ? `$${n.toPrecision(4)}`
    : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};
function Sparkline({ points, up }: { points: string[]; up: boolean }) {
  const values = points.map(Number).filter(Number.isFinite);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const path = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * 60).toFixed(1)},${(17 - ((v - min) / span) * 16).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg
      className={`term-spark ${up ? "up" : "down"}`}
      viewBox="0 0 60 18"
      width="60"
      height="18"
      aria-hidden="true"
    >
      <polyline points={path} />
    </svg>
  );
}

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
  const [observed, setObserved] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<
    { handle: string; calls: number }[] | null
  >(null);
  const [newHandle, setNewHandle] = useState("");
  const [prices, setPrices] = useState<Record<string, SpotPrice>>({});
  const [fades, setFades] = useState<string[]>([]);
  const [source, setSource] = useState<"following" | "everyone">("following");
  const [filter, setFilter] = useState<Filter>("calls");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [status, setStatus] = useState<"live" | "error">("live");
  const [sidebar, setSidebar] = useState<Sidebar | null>(null);
  const [attestations, setAttestations] = useState<Attestations | null>(null);
  const [deletions, setDeletions] = useState<Deletions | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/terminal/attestations", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Attestations>) : null))
        .then((v) => !cancelled && v && setAttestations(v))
        .catch(() => undefined);
      fetch("/api/analytics/deletions", { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<Deletions>) : null))
        .then((v) => !cancelled && v && setDeletions(v))
        .catch(() => undefined);
    };
    load();
    const timer = setInterval(load, 120_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);
  const [notice, setNotice] = useState("");
  const [trade, setTrade] = useState<string | null>(null);
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
          if (viewer) {
            const seen: string[] = [];
            for (const f of (await readFollowing(viewer)).follows) {
              handles.add(f.handle);
              seen.push(f.handle);
            }
            if (!cancelled) setObserved(seen);
          }
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
    const fetchFeed = async (query: URLSearchParams) => {
      const response = await fetch(`/api/terminal/feed?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      return ((await response.json()) as { items: Item[] }).items;
    };
    try {
      const mine = await fetchFeed(params);
      // Real calls from creators not followed yet, so a short following list still has a feed.
      let extra: Item[] = [];
      if (source === "following") {
        const everyone = new URLSearchParams({ filter });
        if (q.trim()) everyone.set("q", q.trim());
        extra = (await fetchFeed(everyone).catch(() => []))
          .filter((item) => !followed.includes(item.signal.handle))
          .slice(0, 20)
          .map((item) => ({ ...item, extra: true }));
      }
      setItems([...mine, ...extra]);
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

  useEffect(() => {
    let cancelled = false;
    const fetchCreators = () =>
      fetch("/api/terminal/creators", { cache: "no-store" })
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{
                creators: { handle: string; calls: number }[];
              }>)
            : null,
        )
        .then((value) => {
          if (!cancelled && value) setSuggested(value.creators);
        })
        .catch(() => undefined);
    void fetchCreators();
    const timer = setInterval(fetchCreators, 300_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Kuru mainnet prices with an on-chain 24h chart; tickers without a market show none.
  useEffect(() => {
    let cancelled = false;
    const fetchPrices = () =>
      fetch("/api/markets/prices", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((value) => {
          const parsed = spotPricesSchema.safeParse(value);
          if (!cancelled && parsed.success)
            setPrices(
              Object.fromEntries(parsed.data.prices.map((p) => [p.asset, p])),
            );
        })
        .catch(() => undefined);
    void fetchPrices();
    const timer = setInterval(fetchPrices, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function unfollow(handle: string) {
    try {
      await extensionWatchlist({ action: "remove", handle });
    } catch {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(readLocalHandles().filter((h) => h !== handle)),
        );
      } catch {}
    }
    setFollowed((current) => (current ?? []).filter((h) => h !== handle));
    setNotice(
      observed.includes(handle)
        ? `Removed @${handle} here. You follow them on X, so they come back on the next sync.`
        : `Unfollowed @${handle}.`,
    );
  }

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
    <>
      <div className="terminal">
        <aside className="term-left">
          <p className="term-live" data-status={status}>
            <i />{" "}
            {status === "live"
              ? "Latest calls"
              : "Feed temporarily unavailable"}
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
          {followed !== null && followed.length === 0 && (
            <p className="small-note">
              Follow creators here, save them from X profiles with the
              extension, or turn on following sync on the{" "}
              <Link className="text-link" href="/dashboard/watchlist">
                Watchlist
              </Link>
              .
            </p>
          )}
          <p className="term-label">Following</p>
          <form
            className="term-follow-form"
            onSubmit={(event) => {
              event.preventDefault();
              const handle = normalizeHandle(
                newHandle.trim().replace(/^@/, ""),
              );
              if (!handle) {
                setNotice("Enter a valid X handle.");
                return;
              }
              void follow(handle);
              setNewHandle("");
            }}
          >
            <input
              className="term-input"
              placeholder="@handle"
              maxLength={16}
              value={newHandle}
              onChange={(event) => setNewHandle(event.target.value)}
              aria-label="Follow an X handle"
            />
            <button type="submit">Follow</button>
          </form>
          {followed && followed.length > 0 && (
            <ul className="term-following">
              {followed.map((handle) => (
                <li key={handle}>
                  <Link href={`/creators/${handle}`}>@{handle}</Link>
                  {observed.includes(handle) && <small>from X</small>}
                  <button
                    type="button"
                    aria-label={`Unfollow @${handle}`}
                    onClick={() => void unfollow(handle)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {suggested?.some((c) => !followed?.includes(c.handle)) && (
            <>
              <p className="term-label">Most active callers · 7d</p>
              <ul className="term-following">
                {suggested
                  .filter((c) => !followed?.includes(c.handle))
                  .slice(0, 8)
                  .map((c) => (
                    <li key={c.handle}>
                      <Link href={`/creators/${c.handle}`}>@{c.handle}</Link>
                      <small>{c.calls} calls</small>
                      <button
                        type="button"
                        className="term-follow-add"
                        onClick={() => void follow(c.handle)}
                      >
                        Follow
                      </button>
                    </li>
                  ))}
              </ul>
            </>
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
            <span>
              {items
                ? `${items.filter((item) => !item.extra).length} posts`
                : "Loading…"}
            </span>
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
          {items?.map((item, index) => {
            const s = item.signal;
            const faded = fades.includes(s.handle);
            const isFollowed = followed?.includes(s.handle);
            return (
              <Fragment key={s.postId}>
                {item.extra && !items[index - 1]?.extra && (
                  <h3 className="term-more">
                    More calls · creators you don't follow yet
                  </h3>
                )}
                <article className="term-card" data-faded={faded || undefined}>
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
                  <p className="term-text">
                    {s.capturedText || s.summary || "(no text)"}
                  </p>
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
                      <button
                        type="button"
                        className="button"
                        onClick={() => setTrade(item.trade.buy)}
                      >
                        Trade ${s.asset}
                      </button>
                    )}
                  </footer>
                </article>
              </Fragment>
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
                {sidebar.trending.map((t) => {
                  const price = prices[t.asset];
                  const change =
                    price?.change24hPct == null
                      ? null
                      : Number(price.change24hPct);
                  return (
                    <li key={t.asset}>
                      <strong>${t.asset}</strong>
                      <span className={`term-bias term-${t.bias}`}>
                        {t.bias}
                      </span>
                      {price ? (
                        <>
                          <span className="term-price">
                            {usd(price.price)}
                            {change !== null && (
                              <em className={change >= 0 ? "up" : "down"}>
                                {change >= 0 ? "+" : "−"}
                                {Math.abs(change).toFixed(2)}%
                              </em>
                            )}
                          </span>
                          <Sparkline
                            points={price.sparkline}
                            up={(change ?? 0) >= 0}
                          />
                        </>
                      ) : (
                        <span className="term-price term-no-price">
                          No Kuru market
                        </span>
                      )}
                      <small>
                        {t.calls} {t.calls === 1 ? "call" : "calls"}
                      </small>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section>
            <p className="term-label">On-chain attestations</p>
            {!attestations?.items.length ? (
              <p className="small-note">
                {attestations
                  ? "No receipt-checked attestations yet."
                  : "Loading from Envio HyperSync…"}
              </p>
            ) : (
              <ul className="term-rail">
                {attestations.items.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <a
                      className="text-link"
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Creator fee paid
                    </a>
                    <small>
                      {a.network} · {a.transactionHash.slice(0, 10)}… ·{" "}
                      {new Date(a.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            <p className="small-note">
              Envio HyperSync events checked against chain receipts.
            </p>
          </section>
          <section>
            <p className="term-label">
              Deleted posts · since day before yesterday
            </p>
            {!deletions ? (
              <p className="small-note">Checking indexed posts…</p>
            ) : (
              <>
                <p className="small-note">
                  {deletions.totals.removed} removed ·{" "}
                  {deletions.totals.suspected} suspected of{" "}
                  {deletions.totals.checked} checked ({deletions.totals.indexed}{" "}
                  indexed).
                </p>
                <ul className="term-rail">
                  {deletions.creators
                    .filter((c) => c.removed + c.suspected > 0)
                    .slice(0, 5)
                    .map((c) => (
                      <li key={c.handle}>
                        <Link
                          className="text-link"
                          href={`/creators/${c.handle}`}
                        >
                          @{c.handle}
                        </Link>
                        <small>
                          {c.removed} removed
                          {c.suspected ? ` · ${c.suspected} suspected` : ""}
                        </small>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </section>
          <p className="small-note">
            Follow/fade uses the median move of a creator&apos;s registered
            calls, or, when they have none, of calls detected in their posts
            priced from the minute they were posted. Only registered calls count
            toward tiers.
          </p>
        </aside>
      </div>
      {trade && (
        <TerminalTradeModal href={trade} onClose={() => setTrade(null)} />
      )}
    </>
  );
}
