import { z } from "zod";
import { payoutRegistration } from "../../../../lib/creator-payouts";
import {
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return reply(await payoutRegistration(request));
  } catch (error) {
    return identityFailure(error);
  }
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = z
      .object({ enabled: z.boolean() })
      .strict()
      .safeParse(await jsonBody(request));
    if (!input.success)
      return reply({ error: "invalid_payout_registration" }, 400);
    return reply(await payoutRegistration(request, input.data.enabled));
  } catch (error) {
    return identityFailure(error);
  }
}
