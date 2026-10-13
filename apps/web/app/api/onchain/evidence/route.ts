import { envioEvidence } from "../../../../lib/envio-evidence";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  const payments = await envioEvidence(143);
  return Response.json(
    { payments },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
