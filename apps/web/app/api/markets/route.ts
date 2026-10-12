import { kuruMarketKeys } from "@call-my-bluff/integrations/kuru";
import { reply } from "../../../lib/identity-http";
import { kuruMarketSnapshot, perplSnapshot } from "../../../lib/markets";
export const dynamic = "force-dynamic";
export async function GET() {
  const [perpl, ...books] = await Promise.allSettled([
    perplSnapshot(),
    ...kuruMarketKeys.map((key) => kuruMarketSnapshot(key)),
  ]);
  return reply({
    chainId: 10143,
    kuru: books.map((result, index) =>
      result.status === "fulfilled"
        ? result.value.state
        : {
            venue: "Kuru",
            key: kuruMarketKeys[index],
            status: "unavailable",
          },
    ),
    perpl:
      perpl.status === "fulfilled"
        ? perpl.value
        : { venue: "Perpl", status: "unavailable" },
  });
}
