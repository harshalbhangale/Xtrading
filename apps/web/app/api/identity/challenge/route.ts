import { IdentityError } from "@call-my-bluff/database/identity";
import {
  bindingChallengeRequestSchema,
  bindingChallengeSchema,
} from "@call-my-bluff/domain";
import {
  identityContext,
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
  requireX,
} from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const origin = requireOrigin(request);
    const body = bindingChallengeRequestSchema.safeParse(
      await jsonBody(request),
    );
    if (!body.success) throw new IdentityError("invalid_body");
    const { user, service, chainId } = await identityContext(request);
    return reply(
      bindingChallengeSchema.parse(
        await service.issue(requireX(user), body.data.wallet, origin, chainId),
      ),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
