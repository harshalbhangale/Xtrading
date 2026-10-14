import { agentConnection } from "../../../../lib/agent-connection";
import { authenticatedUser } from "../../../../lib/identity-auth";
import { identityFailure, reply } from "../../../../lib/identity-http";
export const dynamic = "force-dynamic";

// The signed-in user's own agent status: when their MCP connection was last used.
export async function GET(request: Request) {
  try {
    const user = await authenticatedUser(request);
    const row = await agentConnection(user.privyUserId);
    return reply({
      connected: Boolean(row),
      client: row?.client ?? null,
      lastTool: row?.lastTool ?? null,
      calls: row?.calls ?? 0,
      firstSeenAt: row?.firstSeenAt?.toISOString() ?? null,
      lastSeenAt: row?.lastSeenAt?.toISOString() ?? null,
    });
  } catch (error) {
    return identityFailure(error);
  }
}
