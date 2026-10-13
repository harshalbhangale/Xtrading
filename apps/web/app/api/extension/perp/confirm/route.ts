import { IdentityError } from "@call-my-bluff/database/identity";
import { getAddress, isAddress } from "viem";
import { z } from "zod";
import {
  identityFailure,
  jsonBody,
  reply,
} from "../../../../../lib/identity-http";
import {
  confirmPerpFor,
  perpConfirmSchema,
} from "../../../../../lib/perpl-trade";
import { allow, clientKey } from "../../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  wallet: z.string().refine((value) => isAddress(value)),
  order: perpConfirmSchema,
});

// Reads an order back from chain: it must be sent by that wallet to Perpl's exchange.
export async function POST(request: Request) {
  try {
    if (!allow(`extension-perp:confirm:${clientKey(request)}`, 30))
      return reply({ error: "rate_limited" }, 429);
    const body = bodySchema.safeParse(await jsonBody(request));
    if (!body.success) throw new IdentityError("invalid_body");
    // The extension stays on testnet; mainnet orders go through the signed-in dashboard.
    if (body.data.order.chainId !== 10143)
      throw new IdentityError("trading_testnet_only", 409);
    return reply(
      await confirmPerpFor(getAddress(body.data.wallet), body.data.order),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
