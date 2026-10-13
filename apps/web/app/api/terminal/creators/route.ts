import { reply } from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";
import { activeCreators } from "../../../../lib/terminal";

export const dynamic = "force-dynamic";
/** Public: most active detected callers this week, for the Terminal's suggestions. */
export async function GET(request: Request) {
  if (!allow(`terminal-creators:${clientKey(request)}`, 30))
    return reply({ error: "rate_limited" }, 429);
  try {
    const value = await activeCreators();
    return value ? reply(value) : reply({ error: "creators_unavailable" }, 503);
  } catch {
    return reply({ error: "creators_unavailable" }, 503);
  }
}
