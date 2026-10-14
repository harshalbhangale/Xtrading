import "server-only";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { after } from "next/server";
import { recordAgentCall } from "./agent-connection";
import { verifiedUserId } from "./identity-auth";
import { xtradingMcp } from "./mcp";
import { origin } from "./oauth";
import { allow, clientKey } from "./rate-limit";

// Stateless Streamable HTTP: each request gets its own server and transport.
export async function handleMcp(request: Request) {
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
export function mcpMethodNotAllowed() {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    },
    { status: 405, headers: { allow: "POST" } },
  );
}

/**
 * The connector endpoint (/mcp): every request must carry a live token, so OAuth
 * clients such as claude.ai discover the sign-in flow from the 401 challenge.
 */
function challenge(request: Request) {
  const base = origin(request);
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message: "Sign in to Xtrading to use this connector.",
      },
      id: null,
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource/mcp", scope="mcp"`,
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function handleSignedInMcp(request: Request) {
  if (!(await verifiedUserId(request))) return challenge(request);
  return handleMcp(request);
}

/** GET/DELETE on the connector: challenge without a token, else not allowed. */
export async function signedInMethodNotAllowed(request: Request) {
  if (!(await verifiedUserId(request))) return challenge(request);
  return mcpMethodNotAllowed();
}
