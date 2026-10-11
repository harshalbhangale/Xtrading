import Link from "next/link";

export default function NotFound() {
  return (
    <section className="page-heading">
      <p className="eyebrow">404 / NOT FOUND</p>
      <h1>No receipts here.</h1>
      <p>That page or creator handle could not be found.</p>
      <Link className="button" href="/">
        Back to terminal ↗
      </Link>
    </section>
  );
}
