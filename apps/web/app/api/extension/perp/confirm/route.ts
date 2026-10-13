import { IdentityError } from "@call-my-bluff/database/identity";
import { extensionContext } from "../../../../../lib/extension-session";
import {
  identityFailure,
  jsonBody,
  reply,
} from "../../../../../lib/identity-http";
import { confirmPerp, perpConfirmSchema } from "../../../../../lib/perpl-trade";
import { allow, clientKey } from "../../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

// Called by the extension's service worker with an Extension session, never a cookie.
// Reads back an order the user's browser wallet already sent; nothing is signed here.
export async function POST(request: Request) {
  try {
    if (!allow(`extension-perp:confirm:${clientKey(request)}`, 30))
      return reply({ error: "rate_limited" }, 429);
    const body = perpConfirmSchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    return reply(await confirmPerp(request, body.data, extensionContext));
  } catch (error) {
    return identityFailure(error);
  }
}
