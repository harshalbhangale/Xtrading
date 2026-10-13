import { reply } from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";
import { terminalFeed, terminalQuerySchema } from "../../../../lib/terminal";

export const dynamic = "force-dynamic";
/** Public feed of classified posts; followed handles are passed by the client. */
export async function GET(request: Request) {
  if (!allow(`terminal:${clientKey(request)}`, 30))
    return reply({ error: "rate_limited" }, 429);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = terminalQuerySchema.safeParse(params);
  if (!query.success) return reply({ error: "invalid_query" }, 400);
  try {
    const feed = await terminalFeed(query.data);
    return feed ? reply(feed) : reply({ error: "feed_unavailable" }, 503);
  } catch {
    return reply({ error: "feed_unavailable" }, 503);
  }
}
