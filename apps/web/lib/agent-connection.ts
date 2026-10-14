import "server-only";
import { agentConnections } from "@call-my-bluff/database";
import { eq, sql } from "drizzle-orm";
import { getDatabase } from "./database";
import { verifiedUserId } from "./identity-auth";

type Message = {
  method?: unknown;
  params?: { name?: unknown; clientInfo?: { name?: unknown } };
};
const clean = (value: unknown) =>
  typeof value === "string" && /^[\w .@/:-]{1,60}$/.test(value) ? value : null;

/**
 * Records that a signed-in user's agent reached the MCP server: the client name
 * from `initialize`, the tool from `tools/call`. Only metadata; never the token.
 */
export async function recordAgentCall(request: Request, body: unknown) {
  const database = getDatabase();
  if (!database) return;
  const userId = await verifiedUserId(request);
  if (!userId) return;
  const messages = (Array.isArray(body) ? body : [body]) as Message[];
  let client: string | null = null;
  let tool: string | null = null;
  for (const message of messages) {
    if (message?.method === "initialize")
      client = clean(message.params?.clientInfo?.name);
    if (message?.method === "tools/call") tool = clean(message.params?.name);
  }
  client ??= clean(request.headers.get("user-agent")?.split(/[ /]/)[0]);
  await database.db
    .insert(agentConnections)
    .values({
      privyUserId: userId,
      client,
      lastTool: tool,
      calls: tool ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: agentConnections.privyUserId,
      set: {
        lastSeenAt: sql`now()`,
        ...(client ? { client } : {}),
        ...(tool
          ? { lastTool: tool, calls: sql`${agentConnections.calls} + 1` }
          : {}),
      },
    });
}

export async function agentConnection(privyUserId: string) {
  const database = getDatabase();
  if (!database) return null;
  const [row] = await database.db
    .select()
    .from(agentConnections)
    .where(eq(agentConnections.privyUserId, privyUserId))
    .limit(1);
  return row ?? null;
}
