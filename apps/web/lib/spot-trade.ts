import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  encodeKuruStep,
  kuruAbi,
  kuruTestnet,
  minimumQuotedOutput,
} from "@call-my-bluff/integrations/kuru";
import {
  prepareSpotSchema,
  spotReviewSchema,
} from "@call-my-bluff/integrations/market-schemas";
import { decodeFunctionResult, erc20Abi, getAddress, type Hex } from "viem";
import { identityContext } from "./identity-http";
import { kuruSnapshot } from "./markets";

export async function prepareSpot(request: Request, body: unknown) {
  const parsed = prepareSpotSchema.safeParse(body);
  if (!parsed.success) throw new IdentityError("invalid_trade_intent");
  const input = parsed.data;
  const { user, service, chainId } = await identityContext(request);
  if (chainId !== 10143) throw new IdentityError("trading_testnet_only", 409);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some(
      (wallet) => wallet.toLowerCase() === binding.wallet.toLowerCase(),
    )
  )
    throw new IdentityError("current_binding_required", 403);
  const wallet = getAddress(binding.wallet);
  const { client, block, params } = await kuruSnapshot();
  const at = { blockNumber: block.number };
  const [tokenBalance, allowance, nativeBalance] = await Promise.all([
    client.readContract({
      address: kuruTestnet.quote,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
      ...at,
    }),
    client.readContract({
      address: kuruTestnet.quote,
      abi: erc20Abi,
      functionName: "allowance",
      args: [wallet, kuruTestnet.market],
      ...at,
    }),
    client.getBalance({ address: wallet, ...at }),
  ]);
  const amount = BigInt(input.amount);
  if (amount > (input.side === "buy" ? tokenBalance : nativeBalance))
    throw new IdentityError("insufficient_market_token", 409);
  const stepInput = {
    side: input.side,
    amount,
    minimumOutput: 1n,
    allowance,
    pricePrecision: BigInt(params[0]),
    sizePrecision: params[1],
  };
  let step: ReturnType<typeof encodeKuruStep>;
  try {
    step = encodeKuruStep(stepInput);
  } catch {
    throw new IdentityError("invalid_market_amount", 409);
  }
  let expectedOutput: bigint | null = null,
    minimumOutput: bigint | null = null;
  if (step.action === "order") {
    // Execute the actual FOK order using eth_call, without broadcasting or balance overrides.
    try {
      const result = await client.call({
        account: wallet,
        to: step.to,
        data: step.data,
        value: step.value,
        ...at,
      });
      expectedOutput = decodeFunctionResult({
        abi: kuruAbi,
        functionName:
          input.side === "buy"
            ? "placeAndExecuteMarketBuy"
            : "placeAndExecuteMarketSell",
        data: result.data as Hex,
      });
      minimumOutput = minimumQuotedOutput(expectedOutput, input.slippageBps);
      step = encodeKuruStep({ ...stepInput, minimumOutput });
    } catch {
      throw new IdentityError(
        "quote_unavailable_or_insufficient_liquidity",
        409,
      );
    }
  }
  let gas: bigint;
  try {
    gas = await client.estimateGas({
      account: wallet,
      to: step.to,
      data: step.data,
      value: step.value,
    });
  } catch {
    throw new IdentityError("trade_simulation_failed", 409);
  }
  const gasPrice = await client.getGasPrice();
  if (nativeBalance < step.value + ((gas * 120n) / 100n) * gasPrice)
    throw new IdentityError("insufficient_gas_balance", 409);
  if ((await client.getBlock(at)).hash !== block.hash)
    throw new IdentityError("snapshot_reorg", 503);
  return spotReviewSchema.parse({
    status: "prepared",
    venue: "Kuru",
    instrument: "spot",
    chainId: 10143,
    wallet,
    ...step,
    value: step.value.toString(),
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
    amount: input.amount,
    expectedOutput: expectedOutput?.toString() ?? null,
    minimumOutput: minimumOutput?.toString() ?? null,
    side: input.side,
    sourcePostId: input.sourcePostId,
    slippageBps: input.slippageBps,
    expiresAt: new Date(Date.now() + 30000).toISOString(),
    tradingFee:
      "Included in simulated output; separate fee breakdown unavailable",
    tokenBalance: tokenBalance.toString(),
    nativeBalance: nativeBalance.toString(),
    observedAt: new Date().toISOString(),
    blockNumber: block.number.toString(),
  });
}
