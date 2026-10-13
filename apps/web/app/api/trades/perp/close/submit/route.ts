import { IdentityError } from "@call-my-bluff/database/identity";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../../../lib/identity-http";
import {
  closeSubmitSchema,
  submitPerpClose,
} from "../../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = closeSubmitSchema.safeParse(await jsonBody(request));
    if (!input.success) throw new IdentityError("invalid_body");
    return reply(await submitPerpClose(request, input.data));
  } catch (error) {
    return identityFailure(error);
  }
}
