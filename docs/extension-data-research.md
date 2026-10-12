# Extension data sources

Verified against official documentation and current source on 12 October 2026. These are capabilities, not a successful live API run or a funded trade.

## Nansen

`POST /api/v1/tgm/token-information` accepts a chain, contract address and timeframe (`5m`, `1h`, `6h`, `12h`, `1d`, `7d`). Monad is listed. It exposes USD market cap/FDV and spot volume, buy/sell volume, transaction counts, unique buyers/sellers, USD liquidity and holder count. Responses may be cached for five minutes. The schema does not expose a price or 24h price-change field; do not invent those from this endpoint. [Token information](https://docs.nansen.ai/api/token-god-mode/token-information).

Use volume and liquidity as the first optional token stats. Both describe provider-covered token activity, not necessarily Kuru's own orderbook depth. Do not use Nansen token liquidity as proof that our exact Kuru swap can fill. Validate execution against Kuru simulation and actual book state.

Live indexing can lag by seconds to minutes, with additional endpoint caching. Historical data may be revised. Native coins have narrower endpoint support than contract tokens; test WMON by exact mainnet address and label it WMON rather than silently substituting it for native MON. [Coverage and native-token caveat](https://docs.nansen.ai/api/data-coverage).

For optional smart-money context, `POST /api/v1/tgm/flow-intelligence` is the documented segment-netflow path; the separate Flows endpoint uses hourly/daily buckets and completeness flags. It does not support native tokens. Incomplete buckets are not final evidence. [Flows](https://docs.nansen.ai/api/token-god-mode/flows). Verify response schema, plan access and exact asset before implementing this optional card.

Existing local integration permits only holders, wallet DEX trades and wallet transactions. Add any new endpoint explicitly on the server with response validation. A new buyer's wallet may have no history; token-level analytics are independent of that wallet. Never impersonate someone else's wallet as the bound creator's evidence.

API docs include plan/credit errors. Existing credentials do not guarantee free or unlimited token analytics. Keep current credits, bounded caches and missing states; do not enable paid automatic fallback.

## Kuru

Official mainnet documentation lists a MarginAccount and market-factory Router, separately from KuruFlowEntrypoint (Aggregator). It lists MON-USDC and MON-AUSD markets. The current app uses a different testnet AccountCore/Spot V2 interface, so an address/chain switch alone does not migrate execution. Verify mainnet ABI, balances, fees and events before preparing a real transaction. [Official contracts, tokens and markets](https://docs.kuru.io/contracts/Contract-addresses).

The user supplied bounty text requires routing through Kuru's onchain orderbook. For the demonstration, use a verified supported orderbook market and retain route/fill evidence. An aggregator-branded response is insufficient to establish which venue actually executed. Bounty page could not be fetched in this review; this requirement comes from the user's supplied text. [Bounty link](https://hackathon.monad.xyz/tracks/build-the-next-consumer-trading-app-on-kuru).

Recommended candidate for the first live test: the officially listed MON-USDC market, subject to live liquidity and funding checks. This is a candidate, not a verified executable quote or a recommendation to buy MON. No market price, gas estimate or required funding amount has been asserted here.

## Display contract

Core: exact token/network, original post, pay/receive, input amount, fresh Kuru quote, minimum receive, fees and wallet review. Optional: two Nansen token stats and one expandable creator summary. Unknown values remain unknown. Price, 24h price change, smart-money flow and creator hit rate need their own validated datasets; none should appear just to fill a design tile.
