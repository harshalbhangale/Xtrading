import { publicCallLedger } from "../../../../../lib/calls";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  try {
    const ledger = await publicCallLedger((await params).handle);
    return Response.json(ledger ?? { error: "creator_unavailable" }, {
      status: ledger ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "calls_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
