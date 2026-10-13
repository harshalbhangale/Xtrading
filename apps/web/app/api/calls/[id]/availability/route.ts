import { calls } from "@call-my-bluff/database";
import { checkPostAvailability } from "@call-my-bluff/integrations/calls";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordAvailability } from "../../../../../lib/calls";
import { getDatabase } from "../../../../../lib/database";
import { reply } from "../../../../../lib/identity-http";
import { allow, clientKey } from "../../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return reply({ error: "invalid_call" }, 400);
  if (
    !allow(`post-check:${clientKey(request)}`, 10) ||
    !allow("post-check:global", 60)
  )
    return reply({ error: "rate_limited" }, 429);
  const database = getDatabase();
  if (!database) return reply({ error: "database_unavailable" }, 503);
  try {
    // Only stored calls can be checked; never accept arbitrary URLs or cookies.
    const [call] = await database.db
      .select({ postId: calls.postId })
      .from(calls)
      .where(eq(calls.id, id.data))
      .limit(1);
    if (!call) return reply({ error: "call_not_found" }, 404);
    const result = await checkPostAvailability(call.postId);
    await recordAvailability(id.data, result).catch(() => undefined);
    return reply(result);
  } catch {
    return reply({ error: "post_check_unavailable" }, 503);
  }
}
