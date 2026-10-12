import { creatorOverview } from "../../../../../lib/creator-overview";
import { reply } from "../../../../../lib/identity-http";
import { allow, clientKey } from "../../../../../lib/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  if (!allow(`overview:${clientKey(request)}`, 30))
    return reply({ error: "rate_limited" }, 429);
  try {
    const value = await creatorOverview((await params).handle);
    return value ? reply(value) : reply({ error: "invalid_handle" }, 400);
  } catch {
    return reply({ error: "overview_unavailable" }, 503);
  }
}
