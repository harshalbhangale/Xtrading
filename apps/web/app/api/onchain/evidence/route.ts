import { envioEvidence } from "../../../../lib/envio-evidence";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  const [payments, settlements] = await Promise.all([
    envioEvidence(143),
    envioEvidence(10143),
  ]);
  return Response.json(
    { payments, settlements },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
