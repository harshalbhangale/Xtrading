import { kolRecord } from "../../../../../lib/kol-record";
export const dynamic = "force-dynamic";
/** Reputation tier, progress and red flags; calls are included for evidence links. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const record = await kolRecord((await params).handle);
    return Response.json(
      record
        ? {
            handle: record.handle,
            bound: record.bound,
            assessment: record.assessment,
            calls: record.ledger?.calls ?? [],
            swapsStatus: record.swapsStatus,
            observedAt: record.observedAt,
          }
        : { error: "creator_unavailable" },
      {
        status: record ? 200 : 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { error: "reputation_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
