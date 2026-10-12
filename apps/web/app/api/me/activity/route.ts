import { myActivity } from "../../../../lib/fill-indexing";
import { identityFailure, reply } from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return reply(await myActivity(request));
  } catch (error) {
    return identityFailure(error);
  }
}
