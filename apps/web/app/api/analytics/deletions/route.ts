import { normalizeHandle } from "@call-my-bluff/domain";
import { deletionReport } from "../../../../lib/deletions";
import { reply } from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";

export const dynamic = "force-dynamic";
// The default window starts the day before yesterday (UTC).
function defaultSince() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - 2);
  return d;
}

/** Posts we indexed that X no longer serves. Public, read-only, bounded re-checks. */
export async function GET(request: Request) {
  if (!allow(`deletions:${clientKey(request)}`, 12))
    return reply({ error: "rate_limited" }, 429);
  const params = new URL(request.url).searchParams;
  const handle = normalizeHandle(params.get("handle") ?? "") ?? undefined;
  const sinceParam = params.get("since");
  const since = sinceParam ? new Date(sinceParam) : defaultSince();
  if (Number.isNaN(since.getTime()))
    return reply({ error: "invalid_since" }, 400);
  const report = await deletionReport({ since, handle, sweep: true }).catch(
    () => null,
  );
  if (!report) return reply({ error: "unavailable" }, 503);
  return reply(report);
}
