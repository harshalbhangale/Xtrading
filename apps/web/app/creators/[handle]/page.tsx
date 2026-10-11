import { normalizeHandle } from "@call-my-bluff/domain";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const handle = normalizeHandle((await params).handle);
  if (!handle) notFound();
  return (
    <div className="page subpage">
      <Link className="text-link" href="/creators">
        ← Creator registry
      </Link>
      <p className="eyebrow">Creator record</p>
      <h1>@{handle}</h1>
      <span className="tag">Not indexed</span>
      <div className="empty-state panel">
        <h3>This creator has no record here yet.</h3>
        <p>
          There is no verified identity, indexed stake, or scored history to
          display.
        </p>
        <a
          className="text-link"
          href={`https://x.com/${handle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View X profile ↗
        </a>
      </div>
    </div>
  );
}
