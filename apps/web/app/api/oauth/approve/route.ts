import { authenticatedUser } from "../../../../lib/identity-auth";
import {
  identityFailure,
  jsonBody,
  reply,
} from "../../../../lib/identity-http";
import { approve, OAuthError } from "../../../../lib/oauth";
import { allow, clientKey } from "../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

// The consent page posts here with the user's Privy session after they click Allow.
export async function POST(request: Request) {
  try {
    if (!allow(`oauth-approve:${clientKey(request)}`, 20))
      return reply({ error: "rate_limited" }, 429);
    const user = await authenticatedUser(request);
    const body = (await jsonBody(request)) as { query?: unknown };
    if (typeof body?.query !== "string" || body.query.length > 4000)
      return reply({ error: "invalid_body" }, 400);
    const redirect = await approve(
      user.privyUserId,
      new URLSearchParams(body.query),
    );
    return reply({ redirect });
  } catch (error) {
    if (error instanceof OAuthError)
      return reply({ error: error.code, description: error.description }, 400);
    return identityFailure(error);
  }
}
