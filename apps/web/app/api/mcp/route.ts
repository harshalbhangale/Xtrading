import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { xtradingMcp } from "../../../lib/mcp";
import { allow, clientKey } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

// Stateless Streamable HTTP: each request gets its own server and transport.
async function handle(request: Request) {
  if (!allow(`mcp:${clientKey(request)}`, 120))
    return Response.json({ error: "rate_limited" }, { status: 429 });
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

export { handle as GET, handle as POST, handle as DELETE };
