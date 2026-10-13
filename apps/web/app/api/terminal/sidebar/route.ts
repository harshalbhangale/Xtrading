import { normalizeHandle } from "@call-my-bluff/domain";
import { reply } from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";
import {
  creatorRail,
  terminalIntegrity,
  trendingTickers,
} from "../../../../lib/terminal";

export const dynamic = "force-dynamic";
/** Trending tickers, integrity totals and follow/fade verdicts for up to 8 handles. */
export async function GET(request: Request) {
  if (!allow(`terminal-side:${clientKey(request)}`, 10))
    return reply({ error: "rate_limited" }, 429);
  const handles = [
    ...new Set(
      (new URL(request.url).searchParams.get("handles") ?? "")
        .split(",")
        .map((h) => normalizeHandle(h))
        .filter((h): h is string => Boolean(h)),
    ),
  ].slice(0, 8);
  const [trending, integrity, rail] = await Promise.all([
    trendingTickers().catch(() => null),
    terminalIntegrity().catch(() => null),
    handles.length ? creatorRail(handles).catch(() => null) : [],
  ]);
  return reply({ trending, integrity, rail });
}
