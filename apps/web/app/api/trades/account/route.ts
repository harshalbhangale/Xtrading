import { identityFailure, reply } from "../../../../lib/identity-http";
import { kuruAccount } from "../../../../lib/spot-trade";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return reply(await kuruAccount(request));
  } catch (error) {
    return identityFailure(error);
  }
}
