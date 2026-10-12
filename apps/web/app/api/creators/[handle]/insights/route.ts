import { reply } from "../../../../../lib/identity-http";
import { creatorInsights } from "../../../../../lib/insights";
import { allow, clientKey } from "../../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  if (!allow(`insights:${clientKey(request)}`, 60))
    return reply({ error: "rate_limited" }, 429);
  const url = new URL(request.url);
  const assetParam = url.searchParams.get("asset")?.toUpperCase() ?? null;
  const asset =
    assetParam && /^[A-Z0-9]{1,12}$/.test(assetParam) ? assetParam : null;
  const directionParam = url.searchParams.get("direction");
  const direction =
    directionParam === "bullish" || directionParam === "bearish"
      ? directionParam
      : null;
  try {
    const value = await creatorInsights(
      (await params).handle,
      asset,
      direction,
    );
    return value ? reply(value) : reply({ error: "invalid_handle" }, 400);
  } catch {
    return reply({ error: "insights_unavailable" }, 503);
  }
}
