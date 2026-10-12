import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  EMPTY_BID,
  type KuruMarketKey,
  kuruV2,
  orderBookAbi,
} from "@call-my-bluff/integrations/kuru";
import { perplContextSchema } from "@call-my-bluff/integrations/market-schemas";
import { createPublicClient, erc20Abi, http } from "viem";
import { monadTestnet } from "viem/chains";

export function testnetClient() {
  if (
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID &&
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "10143"
  )
    throw new IdentityError("trading_testnet_only", 409);
  if (!process.env.MONAD_RPC_URL)
    throw new IdentityError("rpc_unconfigured", 503);
  return createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_RPC_URL, {
      timeout: 15000,
      retryCount: 0,
    }),
  });
}

/** Verifies the configured Kuru V2 market at one block before any read is trusted. */
export async function kuruMarketSnapshot(key: KuruMarketKey) {
  const client = testnetClient();
  if ((await client.getChainId()) !== 10143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const config = kuruV2.markets[key];
  const block = await client.getBlock();
  const at = { blockNumber: block.number };
  const native =
    config.base.address === "0x0000000000000000000000000000000000000000";
  const [code, params, top, book, decimals] = await Promise.all([
    client.getCode({ address: config.market, ...at }),
    client.readContract({
      address: config.market,
      abi: orderBookAbi,
      functionName: "getMarketParams",
      ...at,
    }),
    client.readContract({
      address: config.market,
      abi: orderBookAbi,
      functionName: "bestBidAsk",
      ...at,
    }),
    client.readContract({
      address: config.market,
      abi: orderBookAbi,
      functionName: "getL2Book",
      args: [20n],
      ...at,
    }),
    native
      ? config.base.decimals
      : client.readContract({
          address: config.base.address,
          abi: erc20Abi,
          functionName: "decimals",
          ...at,
        }),
  ]);
  if (
    !code ||
    code === "0x" ||
    BigInt(params[0]) !== config.pricePrecision ||
    params[1] !== config.sizePrecision ||
    decimals !== config.base.decimals ||
    !block.hash
  )
    throw new IdentityError("market_verification_failed", 503);
  return {
    client,
    block,
    book,
    takerFeePps: params[5],
    state: {
      venue: "Kuru",
      instrument: "spot",
      chainId: 10143,
      key,
      market: config.market,
      base: config.base,
      quote: kuruV2.quote,
      pricePrecision: params[0].toString(),
      sizePrecision: params[1].toString(),
      minimumQuote: params[3].toString(),
      takerFeePps: params[5].toString(),
      // Empty-book sentinels are reported as null, never as prices.
      bestBid: top[0] === EMPTY_BID ? null : top[0].toString(),
      bestAsk: top[1] === 0 ? null : top[1].toString(),
      blockNumber: block.number.toString(),
      blockHash: block.hash,
      observedAt: new Date().toISOString(),
      finality: "latest-unfinalized",
      execution: "simulation-required",
    },
  };
}

export async function perplSnapshot() {
  // Fixed public discovery endpoint only. No credentials, trading forwarding or arbitrary proxy.
  const response = await fetch("https://testnet.perpl.xyz/api/v1/pub/context", {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Perpl discovery unavailable");
  const context = perplContextSchema.parse(await response.json());
  return {
    venue: "Perpl",
    instrument: "perp",
    chainId: 10143,
    observedAt: new Date().toISOString(),
    source: "https://testnet.perpl.xyz/api/v1/pub/context",
    execution: "unavailable",
    markets: context.markets.map((market) => {
      const instance = context.instances.find(
        (item) => item.id === market.instance_id,
      );
      const collateral = context.tokens.find(
        (item) => item.id === instance?.collateral_token_id,
      );
      if (!instance || !collateral) throw new Error("Incomplete Perpl context");
      return {
        marketId: market.id,
        symbol: market.symbol,
        exchange: instance.address,
        collateral,
        priceDecimals: market.config.price_decimals,
        sizeDecimals: market.config.size_decimals,
        open: market.config.is_open,
      };
    }),
  };
}
