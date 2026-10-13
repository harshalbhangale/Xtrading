import { creatorEarnings } from "../../../../lib/creator-earnings";
import { payoutRegistration } from "../../../../lib/creator-payouts";
import { identityFailure, reply } from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const registration = await payoutRegistration(request);
    return reply(await creatorEarnings(registration.wallet));
  } catch (error) {
    return identityFailure(error);
  }
}
