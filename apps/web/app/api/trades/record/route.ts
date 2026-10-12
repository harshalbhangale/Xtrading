import { recordTrade } from "../../../../lib/fill-indexing";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    return reply(await recordTrade(request, await jsonBody(request)));
  } catch (error) {
    return identityFailure(error);
  }
}
