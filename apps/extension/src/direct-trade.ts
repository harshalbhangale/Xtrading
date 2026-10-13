import { type CreatorFeeBps, decimalAtoms } from "@call-my-bluff/domain";
import {
  confirmedCreatorPayment,
  creatorFeeStep,
  flowAbi,
  flowEntrypoint,
} from "@call-my-bluff/integrations/creator-fees";
import {
  type KuruMarketKey,
  kuruV1OrderBookAbi,
  mainnetOrderSize,
  mainnetTradeStep,
  minimumQuotedOutput,
  networkTradeTokens,
} from "@call-my-bluff/integrations/kuru";
import {
  type Address,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Hex,
  toHex,
  zeroAddress,
} from "viem";
import { WalletError, walletRequest } from "./wallet";

const MONAD = {
  chainId: "0x8f",
  chainName: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://rpc.monad.xyz"],
  blockExplorerUrls: ["https://monadvision.com"],
};

type Step = { to: Address; data: Hex; value: bigint };
type Receipt = {
  status: string;
  logs: { address: Address; data: Hex; topics: Hex[] }[];
};

async function ensureMonadMainnet() {
  if ((await walletRequest<string>("eth_chainId")) === MONAD.chainId) return;
  try {
    await walletRequest("wallet_switchEthereumChain", [
      { chainId: MONAD.chainId },
    ]);
  } catch (error) {
    if (!(error instanceof WalletError) || error.code !== 4902) throw error;
    await walletRequest("wallet_addEthereumChain", [MONAD]);
  }
  if ((await walletRequest<string>("eth_chainId")) !== MONAD.chainId)
    throw new Error("Switch your wallet to Monad mainnet.");
}

const call = (
  from: Address,
  step: { to: Address; data: Hex; value?: bigint },
) =>
  walletRequest<Hex>("eth_call", [
    { from, to: step.to, data: step.data, value: toHex(step.value ?? 0n) },
    "latest",
  ]);

async function readBalance(from: Address, token: Address) {
  if (token === zeroAddress)
    return BigInt(await walletRequest<Hex>("eth_getBalance", [from, "latest"]));
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [from],
  });
  return BigInt(await call(from, { to: token, data }));
}
async function readAllowance(from: Address, token: Address, spender: Address) {
  if (token === zeroAddress) return 0n;
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "allowance",
    args: [from, spender],
  });
  return BigInt(await call(from, { to: token, data }));
}

async function send(from: Address, step: Step) {
  const hash = await walletRequest<Hex>(
    "eth_sendTransaction",
    [{ from, to: step.to, data: step.data, value: toHex(step.value) }],
    300000,
  );
  for (let i = 0; i < 120; i++) {
    const receipt = await walletRequest<Receipt | null>(
      "eth_getTransactionReceipt",
      [hash],
    );
    if (receipt) {
      if (receipt.status !== "0x1")
        throw new Error("Transaction reverted. Nothing was traded.");
      return { hash, receipt };
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Still pending: ${hash}`);
}

export type DirectTradeResult = {
  hash: Hex;
  from: Address;
  creatorPaid: bigint | null;
};

/**
 * Kuru mainnet market order from the user's own browser wallet. Fixed,
 * configured contracts only: an exact approval when needed, an eth_call
 * simulation for the minimum output, then one transaction the user confirms in
 * their wallet. A registered creator is paid inside the same buy via Kuru Flow.
 */
export async function directTrade(input: {
  market: KuruMarketKey;
  side: "buy" | "sell";
  amount: string;
  slippageBps: number;
  creator: { wallet: Address; bps: CreatorFeeBps } | null;
  onStatus: (text: string) => void;
}): Promise<DirectTradeResult> {
  const tokens = networkTradeTokens(143, input.market, input.side);
  const atoms = decimalAtoms(input.amount, tokens.input.decimals);
  if (!atoms) throw new Error("Enter a valid amount.");
  const amount = BigInt(atoms);

  input.onStatus("Connect your wallet…");
  const [account] = await walletRequest<string[]>("eth_requestAccounts");
  if (!account) throw new Error("No wallet account connected.");
  const from = getAddress(account);
  input.onStatus("Checking network…");
  await ensureMonadMainnet();

  const balance = await readBalance(from, tokens.input.address);
  const creator =
    input.side === "buy" &&
    input.creator &&
    input.creator.wallet.toLowerCase() !== from.toLowerCase()
      ? input.creator
      : null;

  if (creator) {
    // Creator-fee buy through Kuru Flow (USDC in, token out).
    if (balance < amount) throw new Error(`Not enough ${tokens.input.symbol}.`);
    let allowance = await readAllowance(
      from,
      tokens.input.address,
      flowEntrypoint,
    );
    const build = (minimumOutput: bigint) =>
      creatorFeeStep({
        market: input.market,
        amount,
        minimumOutput,
        allowance,
        recipient: creator.wallet,
        feeBps: creator.bps,
      });
    if (build(1n).action === "approve") {
      input.onStatus(
        `Approve exactly ${input.amount} ${tokens.input.symbol} (1 of 2)…`,
      );
      await send(from, build(1n));
      allowance = amount;
    }
    const probe = build(1n);
    const out = decodeFunctionResult({
      abi: flowAbi,
      functionName: "executeSwap",
      data: await call(from, probe),
    });
    const order = build(minimumQuotedOutput(out, input.slippageBps));
    input.onStatus("Confirm the buy in your wallet…");
    const { hash, receipt } = await send(from, order);
    return {
      hash,
      from,
      creatorPaid: confirmedCreatorPayment(receipt.logs, {
        buyer: from,
        recipient: creator.wallet,
        token: tokens.output.address,
      }),
    };
  }

  // Plain Kuru order-book market order.
  const { spend } = mainnetOrderSize({
    key: input.market,
    side: input.side,
    amount,
  });
  if (balance < spend) throw new Error(`Not enough ${tokens.input.symbol}.`);
  const market = mainnetTradeStep({
    key: input.market,
    side: input.side,
    amount,
    walletBalance: balance,
    allowance: 0n,
    minimumOutput: 1n,
  }).to;
  let allowance = await readAllowance(from, tokens.input.address, market);
  const build = (minimumOutput: bigint) =>
    mainnetTradeStep({
      key: input.market,
      side: input.side,
      amount,
      walletBalance: balance,
      allowance,
      minimumOutput,
    });
  if (build(1n).action === "approve") {
    input.onStatus(
      `Approve exactly ${input.amount} ${tokens.input.symbol} (1 of 2)…`,
    );
    await send(from, build(1n));
    allowance = spend;
  }
  const probe = build(1n);
  const out = decodeFunctionResult({
    abi: kuruV1OrderBookAbi,
    functionName:
      input.side === "buy"
        ? "placeAndExecuteMarketBuy"
        : "placeAndExecuteMarketSell",
    data: await call(from, probe),
  });
  const order = build(minimumQuotedOutput(out, input.slippageBps));
  input.onStatus("Confirm the trade in your wallet…");
  const { hash } = await send(from, order);
  return { hash, from, creatorPaid: null };
}
