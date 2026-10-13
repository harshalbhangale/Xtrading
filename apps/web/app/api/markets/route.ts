import { kuruMarketKeys } from "@call-my-bluff/integrations/kuru";
import { PERPL_MAINNET } from "@call-my-bluff/integrations/perpl-exchange";
import { reply } from "../../../lib/identity-http";
import {
  kuruMarketSnapshot,
  perplMainnetEnabled,
  perplSnapshot,
} from "../../../lib/markets";
import { perpLimits } from "../../../lib/perpl-trade";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  // ?perplChainId=143 returns Perpl mainnet markets instead of testnet; Kuru books stay testnet.
  const perplMainnet =
    new URL(request.url).searchParams.get("perplChainId") === "143";
  const [perpl, ...books] = await Promise.allSettled([
    perplMainnet ? perplSnapshot(PERPL_MAINNET) : perplSnapshot(),
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
        ? {
            ...perpl.value,
            limits: perpLimits(perplMainnet ? PERPL_MAINNET : undefined),
          }
        : {
            venue: "Perpl",
            chainId: perplMainnet ? 143 : 10143,
            status:
              perplMainnet && !perplMainnetEnabled()
                ? "disabled"
                : "unavailable",
          },
  });
}
