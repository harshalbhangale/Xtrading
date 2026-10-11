import "server-only";
import { createNansenClient } from "@call-my-bluff/integrations/nansen";

// Called by future authenticated evidence services, never by a public arbitrary proxy.
// Nansen's `monad` coverage refers to mainnet, not Monad testnet fixtures.
export function getNansenClient() {
  return createNansenClient(process.env.NANSEN_API_KEY ?? "");
}
