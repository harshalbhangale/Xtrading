import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page subpage">
      <h1>Page not found.</h1>
      <p className="hero-copy">That page or creator handle does not exist.</p>
      <Link className="button" href="/creators">
        Browse creators
      </Link>
    </section>
  );
}
