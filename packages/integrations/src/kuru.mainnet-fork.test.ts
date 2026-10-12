import {
  createPublicClient,
  createWalletClient,
  decodeFunctionResult,
  erc20Abi,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad } from "viem/chains";
import { describe, expect, it } from "vitest";
import {
  kuruMainnet,
  kuruV1OrderBookAbi,
  mainnetTradeStep,
  minimumQuotedOutput,
} from "./kuru";

/**
 * Executes the adapter's own transactions on a local anvil fork of Monad
 * mainnet: `anvil --fork-url https://rpc.monad.xyz --port 8549`, then
 * KURU_MAINNET_FORK_RPC=http://127.0.0.1:8549. Uses anvil's public dev key.
 */
const rpc = process.env.KURU_MAINNET_FORK_RPC;
const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

describe.skipIf(!rpc)("Kuru mainnet on a fork", () => {
  // Vitest still runs this callback when the suite is skipped, and viem
  // throws while building the transport if the URL is missing.
  if (!rpc) return;
  const chain = { ...monad, rpcUrls: { default: { http: [rpc] } } };
  const client = createPublicClient({ chain, transport: http(rpc) });
  const wallet = createWalletClient({ account, chain, transport: http(rpc) });
  const usdc = kuruMainnet.quote.address;
  const balance = () =>
    client.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
  async function execute(input: {
    side: "buy" | "sell";
    amount: bigint;
    walletBalance: bigint;
    allowance: bigint;
  }) {
    const base = { key: "MON" as const, minimumOutput: 1n, ...input };
    let step = mainnetTradeStep(base);
    if (step.action === "approve") {
      const hash = await wallet.sendTransaction(step);
      await client.waitForTransactionReceipt({ hash });
      step = mainnetTradeStep({ ...base, allowance: input.amount });
    }
    const { data } = await client.call({ account: account.address, ...step });
    const expected = decodeFunctionResult({
      abi: kuruV1OrderBookAbi,
      functionName:
        input.side === "buy"
          ? "placeAndExecuteMarketBuy"
          : "placeAndExecuteMarketSell",
      data: data as `0x${string}`,
    });
    const minimumOutput = minimumQuotedOutput(expected, 100);
    const order = mainnetTradeStep({
      ...base,
      allowance: input.amount,
      minimumOutput,
    });
    const hash = await wallet.sendTransaction(order);
    const receipt = await client.waitForTransactionReceipt({ hash });
    return { receipt, expected, minimumOutput };
  }

  it("sells 10 native MON, then buys MON with 0.20 USDC", async () => {
    const before = await balance();
    const sell = await execute({
      side: "sell",
      amount: 10n * 10n ** 18n,
      walletBalance: await client.getBalance({ address: account.address }),
      allowance: 0n,
    });
    expect(sell.receipt.status).toBe("success");
    const received = (await balance()) - before;
    expect(received).toBeGreaterThanOrEqual(sell.minimumOutput);

    const monBefore = await client.getBalance({ address: account.address });
    const buy = await execute({
      side: "buy",
      amount: 200_000n,
      walletBalance: await balance(),
      allowance: 0n,
    });
    expect(buy.receipt.status).toBe("success");
    const gas = buy.receipt.gasUsed * buy.receipt.effectiveGasPrice;
    const monGained =
      (await client.getBalance({ address: account.address })) - monBefore + gas;
    expect(monGained).toBeGreaterThanOrEqual(buy.minimumOutput);
  }, 60_000);
});
