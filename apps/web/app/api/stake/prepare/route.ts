import { IdentityError } from "@call-my-bluff/database/identity";
import { stakeActionSchema } from "@call-my-bluff/domain";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
import { prepareStake } from "../../../../lib/stake";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = stakeActionSchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    return reply(
      await prepareStake(request, body.data.action, body.data.amount),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
