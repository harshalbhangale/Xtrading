import { cors, resourceMetadata } from "../../../../lib/oauth";
export const dynamic = "force-dynamic";

// Served at /.well-known/oauth-protected-resource[/mcp] (see next.config rewrites).
export function GET(request: Request) {
  return Response.json(resourceMetadata(request), {
    headers: cors({ "Cache-Control": "public, max-age=300" }),
  });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}
