import {
  fetchPublicPost,
  parsePostUrl,
  postTimestampMs,
} from "@call-my-bluff/integrations/calls";
import { allow, clientKey } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (
    !allow(`demo-post:${clientKey(request)}`, 10) ||
    !allow("demo-post:global", 60)
  )
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  const input = new URL(request.url).searchParams.get("url") ?? "";
  const parsed = input.length <= 300 ? parsePostUrl(input) : null;
  if (!parsed)
    return Response.json(
      { error: "Enter a public X post URL: https://x.com/handle/status/123" },
      { status: 400 },
    );
  try {
    // The provider endpoint is fixed; the URL author is not trusted. X resolves it.
    const post = await fetchPublicPost(parsed.postId);
    if (!post)
      return Response.json(
        {
          error:
            "This post is not publicly available. Try another public post.",
        },
        { status: 404 },
      );
    return Response.json(
      {
        ...post,
        sourceUrl: `https://x.com/${post.authorHandle}/status/${post.postId}`,
        fetchedAt: new Date().toISOString(),
        publishedAt: new Date(
          Number(postTimestampMs(post.postId)),
        ).toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "X could not provide this post. It may be restricted, or the provider may be unavailable.",
      },
      { status: 503 },
    );
  }
}
