import { z } from "zod";
import { allow, clientKey } from "../../../../lib/rate-limit";
import { walletOverview } from "../../../../lib/wallet-overview";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!allow(`wallet:${clientKey(request)}`, 15))
    return Response.json({ error: "rate_limited" }, { status: 429 });
  const wallet = z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .safeParse(new URL(request.url).searchParams.get("address"));
  if (!wallet.success)
    return Response.json({ error: "invalid_wallet" }, { status: 400 });
  try {
    return Response.json(await walletOverview(wallet.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "wallet_unavailable" }, { status: 503 });
  }
}
