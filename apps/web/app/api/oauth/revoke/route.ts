import { cors, revoke } from "../../../../lib/oauth";
export const dynamic = "force-dynamic";

// RFC 7009: always 200, whether or not the token existed.
export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  const token = new URLSearchParams(text.slice(0, 4000)).get("token") ?? "";
  await revoke(token).catch(() => {});
  return new Response(null, { status: 200, headers: cors() });
}
export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}
