import { postSignalRequestSchema } from "@call-my-bluff/domain";
import { jsonBody, reply } from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";
import { classifyPost } from "../../../../lib/signals";
export const dynamic = "force-dynamic";

// Public, bounded extraction. Image metadata is restricted to X media; never fetched here.
export async function POST(request: Request) {
  if (!allow(`classify:${clientKey(request)}`, 90))
    return reply({ error: "rate_limited" }, 429);
  let body: unknown;
  try {
    body = await jsonBody(request, 8192);
  } catch {
    return reply({ error: "invalid_body" }, 400);
  }
  const parsed = postSignalRequestSchema.safeParse(body);
  if (!parsed.success) return reply({ error: "invalid_body" }, 400);
  try {
    return reply(await classifyPost(parsed.data));
  } catch {
    return reply({ error: "signal_unavailable" }, 503);
  }
}
