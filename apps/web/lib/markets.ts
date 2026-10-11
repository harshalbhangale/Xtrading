import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import { kuruAbi, kuruTestnet } from "@call-my-bluff/integrations/kuru";
import { perplContextSchema } from "@call-my-bluff/integrations/market-schemas";
import { createPublicClient, erc20Abi, http } from "viem";
import { monadTestnet } from "viem/chains";

export async function kuruSnapshot() {
  if (
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID &&
    process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "10143"
  )
    throw new IdentityError("trading_testnet_only", 409);
  if (!process.env.MONAD_RPC_URL)
    throw new IdentityError("rpc_unconfigured", 503);
  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_RPC_URL, {
      timeout: 15000,
      retryCount: 0,
    }),
  });
  if ((await client.getChainId()) !== 10143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const block = await client.getBlock();
  const at = { blockNumber: block.number };
  const [code, params, book, decimals, symbol] = await Promise.all([
    client.getCode({ address: kuruTestnet.market, ...at }),
    client.readContract({
      address: kuruTestnet.market,
      abi: kuruAbi,
      functionName: "getMarketParams",
      ...at,
    }),
    client.readContract({
      address: kuruTestnet.market,
      abi: kuruAbi,
      functionName: "bestBidAsk",
      ...at,
    }),
    client.readContract({
      address: kuruTestnet.quote,
      abi: erc20Abi,
      functionName: "decimals",
      ...at,
    }),
    client.readContract({
      address: kuruTestnet.quote,
      abi: erc20Abi,
      functionName: "symbol",
      ...at,
    }),
  ]);
  if (
    !code ||
    code === "0x" ||
    params[2] !== kuruTestnet.base ||
    params[3] !== 18n ||
    params[4].toLowerCase() !== kuruTestnet.quote.toLowerCase() ||
    params[5] !== 6n ||
    decimals !== 6 ||
    symbol !== "USDC" ||
    !block.hash ||
    (await client.getBlock(at)).hash !== block.hash
  )
    throw new IdentityError("market_verification_failed", 503);
  return {
    client,
    block,
    params,
    state: {
      venue: "Kuru",
      instrument: "spot",
      chainId: 10143,
      market: kuruTestnet.market,
      base: { address: kuruTestnet.base, symbol: "MON", decimals: 18 },
      quote: { address: kuruTestnet.quote, symbol, decimals },
      pricePrecision: params[0].toString(),
      sizePrecision: params[1].toString(),
      minimumSize: params[7].toString(),
      maximumSize: params[8].toString(),
      bestBid: book[0].toString(),
      bestAsk: book[1].toString(),
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
