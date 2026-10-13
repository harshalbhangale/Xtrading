import { IdentityError } from "@call-my-bluff/database/identity";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import {
  identityFailure,
  jsonBody,
  reply,
} from "../../../../../lib/identity-http";
import {
  perpRequestSchema,
  preparePerpFor,
} from "../../../../../lib/perpl-trade";
import { allow, clientKey } from "../../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  wallet: z.string().refine((value) => isAddress(value)),
  order: perpRequestSchema,
});

// Called by the extension's service worker for the wallet MetaMask reports on X.
// Returns unsigned Perpl testnet steps only; that wallet must sign each one.
export async function POST(request: Request) {
  try {
    if (!allow(`extension-perp:prepare:${clientKey(request)}`, 20))
      return reply({ error: "rate_limited" }, 429);
    const body = bodySchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    // The extension stays on testnet; mainnet orders go through the signed-in dashboard.
    if (body.data.order.chainId !== 10143)
      throw new IdentityError("trading_testnet_only", 409);
    return reply(
      await preparePerpFor(getAddress(body.data.wallet), body.data.order),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
