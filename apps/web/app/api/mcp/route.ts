import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { after } from "next/server";
import { recordAgentCall } from "../../../lib/agent-connection";
import { xtradingMcp } from "../../../lib/mcp";
import { allow, clientKey } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

// Stateless Streamable HTTP: each request gets its own server and transport.
async function handle(request: Request) {
  if (!allow(`mcp:${clientKey(request)}`, 120))
    return Response.json({ error: "rate_limited" }, { status: 429 });
  // Signed-in calls mark the user's agent as connected, after the response is sent.
  if (request.headers.get("authorization")) {
    const copy = request.clone();
    after(async () => {
      const body = await copy.json().catch(() => null);
      await recordAgentCall(request, body).catch(() => {});
    });
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = xtradingMcp(request);
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON responses are complete once handleRequest resolves.
    void server.close();
  }
}

// Stateless server: no standalone SSE stream (GET) and no session to end (DELETE).
function methodNotAllowed() {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    },
    { status: 405, headers: { allow: "POST" } },
  );
}

export { handle as POST, methodNotAllowed as GET, methodNotAllowed as DELETE };
