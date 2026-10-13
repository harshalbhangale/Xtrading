import { identityFailure, reply } from "../../../../../lib/identity-http";
import { perpAccount } from "../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return reply(await perpAccount(request));
  } catch (error) {
    return identityFailure(error);
  }
}
