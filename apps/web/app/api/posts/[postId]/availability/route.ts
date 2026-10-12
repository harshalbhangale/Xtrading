import { calls, postSignals } from "@call-my-bluff/database";
import { checkPostAvailability } from "@call-my-bluff/integrations/calls";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDatabase } from "../../../../../lib/database";
import { reply } from "../../../../../lib/identity-http";
import { allow, clientKey } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const postId = z
    .string()
    .regex(/^[0-9]{1,20}$/)
    .safeParse((await params).postId);
  if (!postId.success) return reply({ error: "invalid_post" }, 400);
  if (
    !allow(`post-check:${clientKey(request)}`, 30) ||
    !allow("post-check:global", 120)
  )
    return reply({ error: "rate_limited" }, 429);
  const database = getDatabase();
  if (!database) return reply({ error: "database_unavailable" }, 503);
  try {
    // Only posts we already stored can be checked; never an arbitrary post or URL.
    const [signal] = await database.db
      .select({ postId: postSignals.postId })
      .from(postSignals)
      .where(eq(postSignals.postId, postId.data))
      .limit(1);
    const [call] = signal
      ? []
      : await database.db
          .select({ postId: calls.postId })
          .from(calls)
          .where(eq(calls.postId, postId.data))
          .limit(1);
    if (!signal && !call) return reply({ error: "post_not_found" }, 404);
    return reply(await checkPostAvailability(postId.data));
  } catch {
    return reply({ error: "post_check_unavailable" }, 503);
  }
}
