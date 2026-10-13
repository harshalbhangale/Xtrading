import { llmMode } from "../../../lib/llm";
import { getSetupStatus } from "../../../lib/server-config";

export const dynamic = "force-dynamic";
export function GET() {
  const status = getSetupStatus();
  return Response.json(
    {
      application: "call-my-bluff",
      status: "ok",
      phase: "foundation",
      chainId: status.chain.id,
      integrations: status.integrations,
      // Presence of credentials only; "live" is not proof the provider call succeeds.
      modes: {
        llm: llmMode(),
        nansen: process.env.NANSEN_API_KEY ? "live" : "demo",
        // Orders are signed by each user's own wallet on Perpl testnet; no server key.
        perpl: "wallet",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
