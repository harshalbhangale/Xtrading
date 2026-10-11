"use client";
import Link from "next/link";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="page subpage">
      <h1>This page could not load.</h1>
      <p className="hero-copy">Retry, or go back to the homepage.</p>
      <div className="button-row">
        <button className="button" type="button" onClick={() => retry()}>
          Retry
        </button>
        <Link className="text-link" href="/">
          Home
        </Link>
      </div>
    </section>
  );
}
