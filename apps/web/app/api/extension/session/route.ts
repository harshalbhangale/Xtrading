import { mintExtensionSession } from "../../../../lib/extension-session";
import {
  identityFailure,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
import { allow, clientKey } from "../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

/** Mint a perp-scoped extension session from a verified Privy session (app origin only). */
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    if (!allow(`extension-session:${clientKey(request)}`, 10))
      return reply({ error: "rate_limited" }, 429);
    return reply(await mintExtensionSession(request));
  } catch (error) {
    return identityFailure(error);
  }
}
