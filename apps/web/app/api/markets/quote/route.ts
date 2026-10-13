import {
  inlineQuoteRequestSchema,
  inlineQuoteSchema,
} from "@call-my-bluff/domain";
import {
  bookEstimate,
  kuruV2,
  mainnetTopOfBookEstimate,
  networkTradeTokens,
} from "@call-my-bluff/integrations/kuru";
import { formatUnits } from "viem";
import {
  identityFailure,
  jsonBody,
  reply,
} from "../../../../lib/identity-http";
import {
  kuruMainnetSnapshot,
  kuruMarketSnapshot,
} from "../../../../lib/markets";
import { allow, clientKey } from "../../../../lib/rate-limit";
export const dynamic = "force-dynamic";

/** Public fixed-market indication. No account, signing, approval or provider forwarding. */
export async function POST(request: Request) {
  if (!allow(`inline-quote:${clientKey(request)}`, 90))
    return reply({ error: "rate_limited" }, 429);
  try {
    const parsed = inlineQuoteRequestSchema.safeParse(await jsonBody(request));
    if (!parsed.success) return reply({ error: "invalid_quote" }, 400);
    const input = parsed.data;
    const tokens = networkTradeTokens(input.chainId, input.market, input.side);
    let output: bigint,
      filled: boolean,
      price: string | null,
      blockNumber: bigint;
    if (input.chainId === 10143) {
      const s = await kuruMarketSnapshot(input.market);
      const estimate = bookEstimate({
        key: input.market,
        side: input.side,
        amountIn: BigInt(input.amount),
        book: s.book,
        takerFeePps: s.takerFeePps,
      });
      output = estimate.output;
      filled = estimate.filled;
      blockNumber = s.block.number;
      const top = s.state.bestAsk ?? s.state.bestBid;
      price = top
        ? formatUnits(
            BigInt(top),
            kuruV2.markets[input.market].pricePrecision.toString().length - 1,
          )
        : null;
    } else {
      const s = await kuruMainnetSnapshot(input.market);
      output = mainnetTopOfBookEstimate({
        key: input.market,
        side: input.side,
        spend: BigInt(input.amount),
        bid: s.bid,
        ask: s.ask,
        takerFeeBps: s.takerFeeBps,
      });
      // Top-of-book is not depth proof. Authenticated simulation is required.
      filled = false;
      blockNumber = s.block.number;
      const top = s.ask > 0n ? s.ask : s.bid;
      price = top > 0n && top < 2n ** 255n ? formatUnits(top, 18) : null;
    }
    return reply(
      inlineQuoteSchema.parse({
        ...input,
        input: tokens.input,
        output: tokens.output,
        expectedOutput: output > 0n ? output.toString() : null,
        price,
        filled,
        blockNumber: blockNumber.toString(),
        observedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15000).toISOString(),
        kind: "indicative",
        note: "Book indication only. Wallet balances, gas, minimum output and any creator fee are verified in the secure wallet review.",
      }),
    );
  } catch (error) {
    return identityFailure(error);
  }
}
