import { IdentityError } from "@call-my-bluff/database/identity";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../../lib/identity-http";
import { perpRequestSchema, preparePerp } from "../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = perpRequestSchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    return reply(await preparePerp(request, body.data));
  } catch (error) {
    return identityFailure(error);
  }
}
