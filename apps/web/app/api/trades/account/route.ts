import { identityFailure, reply } from "../../../../lib/identity-http";
import { kuruAccount } from "../../../../lib/spot-trade";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const chainId =
      new URL(request.url).searchParams.get("chainId") === "143" ? 143 : 10143;
    return reply(await kuruAccount(request, chainId));
  } catch (error) {
    return identityFailure(error);
  }
}
