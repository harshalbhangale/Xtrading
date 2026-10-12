"use client";
import { type DetectedPost, tradeReviewPath } from "@call-my-bluff/domain";
import { tokenReferences } from "@call-my-bluff/integrations/token-references";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function ImageText({ url }: { url: string }) {
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), []);
  const [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [error, setError] = useState("");
  async function read() {
    setBusy(true);
    setError("");
    let worker:
      | Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>
      | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let ended = false;
    cancel.current = () => {
      ended = true;
      void worker?.terminate().catch(() => {});
    };
    try {
      const { createWorker } = await import("tesseract.js");
      const work = (async () => {
        worker = await createWorker("eng", 1, {
          workerPath:
            "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0",
        });
        if (ended) {
          await worker.terminate();
          throw new Error("cancelled");
        }
        return worker.recognize(url);
      })();
      const result = await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new Error("timeout"));
          }, 60000);
        }),
      ]);
      if (!ended)
        setText(result.data.text.slice(0, 4000) || "No readable text found.");
    } catch {
      if (!ended)
        setError(
          "Could not read this image. View the original post to inspect it.",
        );
    } finally {
      clearTimeout(timeout);
      if (!ended) setBusy(false);
      ended = true;
      if (worker) await worker.terminate().catch(() => {});
      cancel.current = null;
    }
  }
  return (
    <div>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={() => void read()}
      >
        {busy ? "Reading image…" : "Read image text"}
      </button>
      <p className="small-note">
        Processed in your browser. Initial use downloads the OCR engine. Text
        may contain mistakes and is not verified trade data.
      </p>
      {error && <p role="status">{error}</p>}
      {text && (
        <>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {text}
          </pre>
          {tokenReferences(text).map((ref) => (
            <p key={ref.address} style={{ overflowWrap: "anywhere" }}>
              Possible {ref.kind} address from image: {ref.address} · check
              every character in the original.
            </p>
          ))}
        </>
      )}
    </div>
  );
}

export function DetectedPostCard({ post }: { post: DetectedPost }) {
  const { signal, route } = post;
  return (
    <article className="panel">
      <h3>
        {signal.asset ?? "Token reference"} ·{" "}
        {signal.direction ?? "No direction stated"}
      </h3>
      <p>{signal.summary}</p>
      <p className="small-note">
        Browser-submitted observation; post text, images and addresses are not
        independently verified.
      </p>
      <p className="small-note">
        Captured {signal.classifiedAt} ·{" "}
        {signal.isCall
          ? "Detected call"
          : "Address reference, not a scored call"}{" "}
        · Outcome not evaluated.
      </p>
      {signal.tokenReferences.map((ref) => (
        <p key={ref.address} style={{ overflowWrap: "anywhere" }}>
          {ref.kind === "solana" ? "Solana-shaped" : "EVM · chain unverified"}{" "}
          address: <code>{ref.address}</code> · token identity unverified
        </p>
      ))}
      {signal.images.map((image) => (
        <figure key={image.url}>
          <a href={image.url} target="_blank" rel="noopener noreferrer">
            <Image
              width={800}
              height={600}
              unoptimized
              src={image.url}
              alt={image.alt || "Post image"}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{ width: "100%", maxHeight: 320, objectFit: "contain" }}
            />
          </a>
          <ImageText url={image.url} />
        </figure>
      ))}
      <div className="button-row">
        <a
          className="button"
          href={`https://x.com/${signal.handle}/status/${signal.postId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View post ↗
        </a>
        {(["buy", "sell"] as const).map((side) => {
          const path = tradeReviewPath(signal, route, side);
          const label =
            route.status === "available" && route.instrument === "perp"
              ? side === "buy"
                ? "Long"
                : "Short"
              : side === "buy"
                ? "Buy"
                : "Sell";
          return path ? (
            <Link className="button" key={side} href={path}>
              {label} · review
            </Link>
          ) : (
            <button className="button" type="button" key={side} disabled>
              {label} unavailable
            </button>
          );
        })}
      </div>
      <p className="small-note">
        {route.status === "available"
          ? `${route.venue} · Monad testnet. Amounts and wallet approval follow in review.`
          : route.reason}
      </p>
    </article>
  );
}
