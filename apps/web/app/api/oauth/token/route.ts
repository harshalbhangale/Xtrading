import {
  cors,
  exchange,
  OAuthError,
  oauthFailure,
} from "../../../../lib/oauth";
import { allow, clientKey } from "../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

async function form(request: Request) {
  const text = await request.text();
  if (text.length > 8000)
    throw new OAuthError("invalid_request", "Body too large.");
  if (
    (request.headers.get("content-type") ?? "").includes("application/json")
  ) {
    try {
      const value = JSON.parse(text) as Record<string, unknown>;
      return new URLSearchParams(
        Object.entries(value).flatMap(([k, v]) =>
          typeof v === "string" ? [[k, v]] : [],
        ),
      );
    } catch {
      throw new OAuthError("invalid_request", "Invalid JSON.");
    }
  }
  return new URLSearchParams(text);
}

export async function POST(request: Request) {
  try {
    if (!allow(`oauth-token:${clientKey(request)}`, 60))
      throw new OAuthError("slow_down", "Too many requests.", 429);
    return Response.json(await exchange(await form(request)), {
      headers: cors({ "Cache-Control": "no-store", Pragma: "no-cache" }),
    });
  } catch (error) {
    return oauthFailure(error);
  }
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}
