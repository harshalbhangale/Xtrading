import "server-only";
import { getMonadChain, integrationStatus } from "@call-my-bluff/integrations";

export function getSetupStatus() {
  return {
    chain: getMonadChain(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID),
    integrations: integrationStatus(process.env),
    stakeDeployed: Boolean(process.env.CREATOR_STAKE_ADDRESS),
  };
}
