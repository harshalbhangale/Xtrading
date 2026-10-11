import { identityFailure, reply } from "../../../lib/identity-http";
import { stakeContext } from "../../../lib/stake";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return reply((await stakeContext(request)).state);
  } catch (error) {
    return identityFailure(error);
  }
}
