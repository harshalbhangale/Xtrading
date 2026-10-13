import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
import { prepareTransfer } from "../../../../lib/wallet";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    return reply(await prepareTransfer(request, await jsonBody(request)));
  } catch (error) {
    return identityFailure(error);
  }
}
