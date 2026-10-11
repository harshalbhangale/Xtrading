import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
import { prepareWithdraw } from "../../../../lib/spot-trade";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    return reply(await prepareWithdraw(request, await jsonBody(request)));
  } catch (error) {
    return identityFailure(error);
  }
}
