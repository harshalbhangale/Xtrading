import { IdentityError } from "@call-my-bluff/database/identity";
import { isAddress } from "viem";
import { identityFailure, reply } from "../../../../../lib/identity-http";
import { perpHistory } from "../../../../../lib/perp-history";
import { allow, clientKey } from "../../../../../lib/rate-limit";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Public chain data for one wallet: Perpl orders, fills, open positions and PnL.
export async function GET(request: Request) {
  try {
    if (!allow(`perp-history:${clientKey(request)}`, 30))
      return reply({ error: "rate_limited" }, 429);
    const url = new URL(request.url);
    const wallet = url.searchParams.get("wallet") ?? "";
    const chainId = Number(url.searchParams.get("chainId") ?? "10143");
    if (!isAddress(wallet, { strict: false }))
      throw new IdentityError("invalid_wallet");
    if (chainId !== 10143 && chainId !== 143)
      throw new IdentityError("unsupported_chain", 409);
    return reply(await perpHistory({ wallet, chainId }));
  } catch (error) {
    return identityFailure(error);
  }
}
