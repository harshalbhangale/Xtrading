import { reply } from "../../../lib/identity-http";
import { kuruSnapshot, perplSnapshot } from "../../../lib/markets";
export const dynamic = "force-dynamic";
export async function GET() {
  const [kuru, perpl] = await Promise.allSettled([
    kuruSnapshot(),
    perplSnapshot(),
  ]);
  return reply({
    chainId: 10143,
    kuru:
      kuru.status === "fulfilled"
        ? kuru.value.state
        : { venue: "Kuru", status: "unavailable" },
    perpl:
      perpl.status === "fulfilled"
        ? perpl.value
        : { venue: "Perpl", status: "unavailable" },
  });
}
