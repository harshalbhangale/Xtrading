import { identityFailure, reply } from "../../../lib/identity-http";
import { stakeContext } from "../../../lib/stake";
import { indexedStake } from "../../../lib/stake-indexing";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const { state } = await stakeContext(request);
    return reply({ ...state, indexing: await indexedStake(state) });
  } catch (error) {
    return identityFailure(error);
  }
}
