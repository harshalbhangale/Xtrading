import { IdentityError } from "@call-my-bluff/database/identity";
import {
  bindingProofSchema,
  identityBindingSchema,
} from "@call-my-bluff/domain";
import type { Hex } from "viem";
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
    const body = bindingProofSchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    const { user, service, chainId } = await identityContext(request);
    return reply(
      identityBindingSchema.parse(
        await service.bind(
          requireX(user),
          body.data.challengeId,
          body.data.signature as Hex,
          origin,
          chainId,
        ),
      ),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
