import { normalizeHandle } from "@call-my-bluff/domain";
import { publicPayout } from "../../../../../lib/creator-payouts";
import { identityFailure, reply } from "../../../../../lib/identity-http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const handle = normalizeHandle((await params).handle);
  if (!handle) return reply({ error: "invalid_handle" }, 400);
  try {
    return reply(await publicPayout(handle));
  } catch (error) {
    return identityFailure(error);
  }
}
