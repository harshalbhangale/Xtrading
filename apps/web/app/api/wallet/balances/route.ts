import { identityFailure, reply } from "../../../../lib/identity-http";
import { walletBalances } from "../../../../lib/wallet";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    // Testnet unless mainnet is named explicitly.
    const chainId =
      new URL(request.url).searchParams.get("chainId") === "143" ? 143 : 10143;
    return reply(await walletBalances(request, chainId));
  } catch (error) {
    return identityFailure(error);
  }
}
