import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
import { prepareSpot } from "../../../../lib/spot-trade";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    return reply(await prepareSpot(request, await jsonBody(request)));
  } catch (error) {
    return identityFailure(error);
  }
}
