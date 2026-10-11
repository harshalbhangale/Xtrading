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
      <p className="eyebrow">The record could not load</p>
      <h1>Let’s try that again.</h1>
      <p className="hero-copy">
        Something interrupted this page. Please retry or return to the homepage.
      </p>
      <div className="button-row">
        <button className="button" type="button" onClick={() => retry()}>
          Retry page ↗
        </button>
        <Link className="text-link" href="/">
          Back to home ↗
        </Link>
      </div>
    </section>
  );
}
