import { creatorDashboard } from "../../../../lib/creator-dashboard";
import { identityFailure, reply } from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return reply(await creatorDashboard(request));
  } catch (error) {
    return identityFailure(error);
  }
}
