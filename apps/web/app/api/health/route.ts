import { llmMode } from "../../../lib/llm";
import { perplMode } from "../../../lib/perpl-trade";
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
        perpl: perplMode(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
