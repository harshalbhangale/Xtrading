import { registerCall } from "../../../lib/calls";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    return reply(await registerCall(request, await jsonBody(request)), 201);
  } catch (error) {
    return identityFailure(error);
  }
}
