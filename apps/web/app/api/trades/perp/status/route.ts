import { identityFailure, reply } from "../../../../../lib/identity-http";
import { perpStatus } from "../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const rq = Number(new URL(request.url).searchParams.get("rq"));
    return reply(await perpStatus(request, rq));
  } catch (error) {
    return identityFailure(error);
  }
}
