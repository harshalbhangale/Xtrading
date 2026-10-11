import { IdentityError } from "@call-my-bluff/database/identity";

import { encodeKuruStep, kuruTestnet } from "@call-my-bluff/integrations/kuru";
import { prepareSpotSchema } from "@call-my-bluff/integrations/market-schemas";
import { erc20Abi, getAddress } from "viem";
import {
  identityContext,
  identityFailure,
  jsonBody,
  reply,
  requireOrigin,
} from "../../../../lib/identity-http";
import { kuruSnapshot } from "../../../../lib/markets";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const parsed = prepareSpotSchema.safeParse(await jsonBody(request));
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
    const { client, block, params, state } = await kuruSnapshot();
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
    let step: ReturnType<typeof encodeKuruStep>;
    try {
      step = encodeKuruStep({
        side: input.side,
        amount,
        minimumOutput: BigInt(input.minimumOutput),
        allowance,
        pricePrecision: BigInt(params[0]),
        sizePrecision: params[1],
      });
    } catch {
      throw new IdentityError("invalid_market_amount", 409);
    }
    // Simulate the unsigned next step. An approval is not an order simulation or fill.
    const gas = await client.estimateGas({
      account: wallet,
      to: step.to,
      data: step.data,
      value: step.value,
    });
    const gasPrice = await client.getGasPrice();
    if (nativeBalance < step.value + ((gas * 120n) / 100n) * gasPrice)
      throw new IdentityError("insufficient_gas_balance", 409);
    if ((await client.getBlock(at)).hash !== block.hash)
      throw new IdentityError("snapshot_reorg", 503);
    return reply({
      status: "prepared",
      venue: "Kuru",
      instrument: "spot",
      chainId: 10143,
      wallet,
      ...step,
      value: step.value.toString(),
      gas: gas.toString(),
      amount: input.amount,
      minimumOutput: input.minimumOutput,
      side: input.side,
      sourcePostId: input.sourcePostId,
      sourceAttribution: "user-supplied-unverified",
      expiresAt: new Date(Date.now() + 90000).toISOString(),
      expiryEnforcement: "app-review-only", // Market ABI has no deadline argument.
      quote: "user-specified-minimum-output",
      fillOrKill: true,
      simulation: step.action === "order" ? "order-estimated" : "approval-only",
      market: state,
    });
  } catch (error) {
    return identityFailure(error);
  }
}
