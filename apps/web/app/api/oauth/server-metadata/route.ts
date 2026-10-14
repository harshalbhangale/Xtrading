import { cors, serverMetadata } from "../../../../lib/oauth";
export const dynamic = "force-dynamic";

// Served at /.well-known/oauth-authorization-server (see next.config rewrites).
export function GET(request: Request) {
  return Response.json(serverMetadata(request), {
    headers: cors({ "Cache-Control": "public, max-age=300" }),
  });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}
