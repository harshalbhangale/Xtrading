import { IdentityError } from "@call-my-bluff/database/identity";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../../lib/identity-http";
import { confirmPerp, perpConfirmSchema } from "../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";

// Reads back an order the user's wallet already sent; nothing is signed here.
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = perpConfirmSchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    return reply(await confirmPerp(request, body.data));
  } catch (error) {
    return identityFailure(error);
  }
}
