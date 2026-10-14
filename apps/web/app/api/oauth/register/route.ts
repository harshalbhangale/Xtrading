import {
  cors,
  OAuthError,
  oauthFailure,
  registerClient,
} from "../../../../lib/oauth";
import { allow, clientKey } from "../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

// Dynamic client registration (RFC 7591), public clients only.
export async function POST(request: Request) {
  try {
    if (!allow(`oauth-register:${clientKey(request)}`, 20))
      throw new OAuthError("slow_down", "Too many registrations.", 429);
    const text = await request.text();
    if (text.length > 8000)
      throw new OAuthError("invalid_client_metadata", "Body too large.");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new OAuthError("invalid_client_metadata", "Body must be JSON.");
    }
    return Response.json(await registerClient(body), {
      status: 201,
      headers: cors({ "Cache-Control": "no-store" }),
    });
  } catch (error) {
    return oauthFailure(error);
  }
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}
