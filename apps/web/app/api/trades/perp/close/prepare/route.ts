import { IdentityError } from "@call-my-bluff/database/identity";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../../../lib/identity-http";
import {
  closeRequestSchema,
  preparePerpClose,
} from "../../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = closeRequestSchema.safeParse(await jsonBody(request));
    if (!input.success) throw new IdentityError("invalid_body");
    return reply(await preparePerpClose(request, input.data));
  } catch (error) {
    return identityFailure(error);
  }
}
