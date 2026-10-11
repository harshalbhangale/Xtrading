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
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
