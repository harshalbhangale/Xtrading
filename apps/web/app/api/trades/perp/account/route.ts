import { IdentityError } from "@call-my-bluff/database/identity";
import { identityFailure, reply } from "../../../../../lib/identity-http";
import { perpAccount } from "../../../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
// ?chainId=143 reads the mainnet account; testnet when omitted.
export async function GET(request: Request) {
  try {
    const chainId = new URL(request.url).searchParams.get("chainId") ?? "10143";
    if (chainId !== "10143" && chainId !== "143")
      throw new IdentityError("unsupported_chain", 409);
    return reply(await perpAccount(request, Number(chainId)));
  } catch (error) {
    return identityFailure(error);
  }
}
