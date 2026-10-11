import { publicCreatorEvidence } from "../../../../lib/public-creator";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const value = await publicCreatorEvidence((await params).handle);
    return Response.json(value ?? { error: "invalid_handle" }, {
      status: value ? 200 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "evidence_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
