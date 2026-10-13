"use client";

import {
  type KolAssessment,
  type PublicCreatorEvidence,
  postSignalResponseSchema,
  publicCreatorEvidenceSchema,
  tierName,
  tradeReviewPath,
} from "@call-my-bluff/domain";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface PublicPost {
  postId: string;
  authorHandle: string;
  text: string;
  sourceUrl: string;
  fetchedAt: string;
  publishedAt: string;
}
type Analysis = ReturnType<typeof postSignalResponseSchema.parse>;

export function LiveXDemo() {
  const [url, setUrl] = useState("");
  const [post, setPost] = useState<PublicPost | null>(null);
  const [evidence, setEvidence] = useState<PublicCreatorEvidence | null>(null);
  const [reputation, setReputation] = useState<KolAssessment | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [contextError, setContextError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function load(input = url) {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setChecking(false);
    setError("");
    setContextError("");
    setPost(null);
    setEvidence(null);
    setAnalysis(null);
    try {
      const response = await fetch(
        `/api/demo/post?url=${encodeURIComponent(input)}`,
        { signal: controller.signal },
      );
      const value = await response.json();
      if (!response.ok) throw new Error(value.error ?? "Post unavailable.");
      if (!controller.signal.aborted) setPost(value);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error ? reason.message : "Unable to load the post.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function check() {
    if (!post) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setEvidence(null);
    setReputation(null);
    setAnalysis(null);
    setChecking(true);
    setContextError("");
    const results = await Promise.allSettled([
      fetch(`/api/creators/${post.authorHandle}`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Creator evidence unavailable.");
        return publicCreatorEvidenceSchema.parse(await response.json());
      }),
      fetch(`/api/creators/${post.authorHandle}/reputation`, {
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Reputation unavailable.");
        return ((await response.json()) as { assessment: KolAssessment })
          .assessment;
      }),
      fetch("/api/signals/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.postId,
          handle: post.authorHandle,
          text: post.text,
          images: [],
        }),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Call extraction unavailable.");
        return postSignalResponseSchema.parse(await response.json());
      }),
    ]);
    if (controller.signal.aborted) return;
    const [record, tier, signal] = results;
    if (record?.status === "fulfilled") setEvidence(record.value);
    if (tier?.status === "fulfilled") setReputation(tier.value);
    if (signal?.status === "fulfilled") setAnalysis(signal.value);
    if (results.some((result) => result.status === "rejected"))
      setContextError(
        "Some context is unavailable. Available results are shown below.",
      );
    setChecking(false);
  }
  const review = analysis
    ? tradeReviewPath(analysis.signal, analysis.route)
    : null;
  return (
    <div className="x-live-demo">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
        className="x-post-form"
      >
        <label htmlFor="x-post-url">TRY A REAL X POST</label>
        <div>
          <input
            id="x-post-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://x.com/handle/status/…"
            required
            maxLength={300}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Loading…" : "Load post ↗"}
          </button>
        </div>
        <p>Public posts only. Loaded from X, with context from Xtrading.</p>
      </form>
      {error && (
        <p className="x-demo-error" role="alert">
          {error}
        </p>
      )}
      <div className="x-demo-grid">
        <div className="x-real-post">
          <div className="x-feed-heading">
            <span>𝕏</span>
            <span>THE SOURCE POST</span>
          </div>
          {post ? (
            <>
              <div className="x-real-author">
                <span className="x-real-avatar" aria-hidden="true">
                  {post.authorHandle.slice(0, 1).toUpperCase()}
                </span>
                <a href={post.sourceUrl} target="_blank" rel="noreferrer">
                  @{post.authorHandle} <span>View on X ↗</span>
                </a>
              </div>
              <p className="x-real-text">{post.text}</p>
              <p className="x-source-note">
                Posted {new Date(post.publishedAt).toLocaleDateString()} ·
                public text excerpt
                <br />
                Fetched {new Date(post.fetchedAt).toLocaleTimeString()}
                <br />
                Handle resolved by X. No engagement counts or identity badge
                inferred.
              </p>
              <button
                type="button"
                className="xp-button"
                disabled={checking}
                onClick={() => void check()}
              >
                {checking ? "Checking…" : "Check this call →"}
              </button>
            </>
          ) : (
            <div className="x-demo-empty">
              <span>
                Real posts.
                <br />
                Real context.
              </span>
              <p>Paste a public post to load it from X.</p>
              <button
                type="button"
                onClick={() => {
                  const example =
                    "https://x.com/jussy_world/status/1977805240000037118";
                  setUrl(example);
                  void load(example);
                }}
                disabled={busy}
              >
                Try a public example ↗
              </button>
            </div>
          )}
        </div>
        <div className="x-real-context" aria-live="polite">
          <div className="x-feed-heading">
            <span>↗</span>
            <span>XTRADING CONTEXT</span>
          </div>
          {!evidence && !analysis ? (
            <div className="x-context-empty">
              <p>
                {checking
                  ? "Reading the post and checking its creator…"
                  : "The record, beside the post."}
              </p>
              <span>Identity · Tier · Red flags · Trade review</span>
            </div>
          ) : (
            <>
              <div className="x-context-line">
                <span>X / wallet binding</span>
                <strong>
                  {evidence?.identity.status === "bound"
                    ? "Binding recorded"
                    : "Unavailable"}
                </strong>
              </div>
              <div className="x-context-line">
                <span>Reputation tier</span>
                <strong>
                  {reputation
                    ? (tierName(reputation.tier) ?? "No tier yet")
                    : "Unavailable"}
                </strong>
              </div>
              <div className="x-context-line">
                <span>Red flags</span>
                <strong>
                  {reputation
                    ? reputation.flags.length
                      ? reputation.flags.map((flag) => flag.title).join(" · ")
                      : "None found"
                    : "Unavailable"}
                </strong>
              </div>
              <div className="x-context-line">
                <span>Call detected</span>
                <strong>
                  {analysis
                    ? analysis.signal.isCall
                      ? "Yes"
                      : "No explicit call"
                    : "Unavailable"}
                </strong>
              </div>
              {analysis && (
                <>
                  <p className="x-call-summary">{analysis.signal.summary}</p>
                  <p className="x-source-note">
                    {analysis.signal.source === "llm"
                      ? "Model extraction"
                      : "Rules extraction"}{" "}
                    · Outcome not evaluated.
                    <br />
                    Wallet returns are not inferred from the post.
                  </p>
                </>
              )}
              {review ? (
                <Link className="xp-button" href={review}>
                  Open trade review ↗
                </Link>
              ) : (
                <p className="x-source-note">
                  {analysis?.route.status === "unavailable"
                    ? analysis.route.reason
                    : "No supported trade route identified."}
                </p>
              )}
              {post && (
                <Link
                  href={`/creators/${post.authorHandle}`}
                  className="xp-text-link"
                >
                  Open creator record ↗
                </Link>
              )}
            </>
          )}
          {contextError && <p className="x-demo-error">{contextError}</p>}
        </div>
      </div>
      <p className="x-demo-footnote">
        Monad mainnet & testnet · You review and sign in the trading workspace.
        Identity, tier and wallet returns remain separate.
      </p>
    </div>
  );
}
