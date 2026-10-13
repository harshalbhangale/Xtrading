import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  prepareTransferSchema,
  TransferError,
  transferReviewSchema,
  transferStep,
  type WalletChainId,
  walletBalancesSchema,
  walletToken,
  walletTokens,
} from "@call-my-bluff/integrations/wallet";
import {
  type Address,
  erc20Abi,
  getAddress,
  isAddress,
  zeroAddress,
} from "viem";
import { authenticatedUser } from "./identity-auth";
import { mainnetClient, testnetClient } from "./markets";

const REVIEW_SECONDS = 30;

async function chainClient(chainId: WalletChainId) {
  const client = chainId === 143 ? mainnetClient() : testnetClient();
  if ((await client.getChainId()) !== chainId)
    throw new IdentityError("rpc_chain_mismatch", 503);
  return client as ReturnType<typeof testnetClient>;
}

/**
 * A wallet the verified Privy session owns (embedded or linked). Sending your
 * own funds needs no X binding; identity and wallet ownership stay separate.
 */
async function ownedWallet(request: Request, requested: string | null) {
  const user = await authenticatedUser(request);
  if (user.wallets.length === 0)
    throw new IdentityError("wallet_required", 409);
  if (!requested) return getAddress(user.wallets[0] as string);
  if (!isAddress(requested, { strict: false }))
    throw new IdentityError("invalid_wallet");
  const wallet = getAddress(requested);
  if (!user.wallets.some((w) => getAddress(w) === wallet))
    throw new IdentityError("wallet_not_owned", 403);
  return wallet;
}

async function balanceOf(
  client: ReturnType<typeof testnetClient>,
  token: Address,
  wallet: Address,
  blockNumber: bigint,
) {
  return token === zeroAddress
    ? client.getBalance({ address: wallet, blockNumber })
    : client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
        blockNumber,
      });
}

export async function walletBalances(request: Request, chainId: WalletChainId) {
  const url = new URL(request.url);
  const wallet = await ownedWallet(request, url.searchParams.get("address"));
  const client = await chainClient(chainId);
  const block = await client.getBlock();
  const balances = await Promise.all(
    walletTokens(chainId).map(async (token) => ({
      token,
      balance: (
        await balanceOf(client, token.address, wallet, block.number)
      ).toString(),
    })),
  );
  return walletBalancesSchema.parse({
    chainId,
    wallet,
    balances,
    observedAt: new Date().toISOString(),
    blockNumber: block.number.toString(),
  });
}

export async function prepareTransfer(request: Request, body: unknown) {
  const parsed = prepareTransferSchema.safeParse(body);
  if (!parsed.success) throw new IdentityError("invalid_transfer");
  const { chainId, from, to: recipient } = parsed.data;
  const wallet = await ownedWallet(request, from);
  const token = walletToken(chainId, parsed.data.token);
  if (!token) throw new IdentityError("unsupported_token");
  const amount = BigInt(parsed.data.amount);
  let step: ReturnType<typeof transferStep>;
  try {
    step = transferStep({ token, from: wallet, recipient, amount });
  } catch (error) {
    if (error instanceof TransferError) throw new IdentityError(error.code);
    throw error;
  }
  const client = await chainClient(chainId);
  const block = await client.getBlock();
  const [nativeBalance, held] = await Promise.all([
    client.getBalance({ address: wallet, blockNumber: block.number }),
    balanceOf(client, token.address, wallet, block.number),
  ]);
  if (amount > held) throw new IdentityError("insufficient_balance", 409);
  let gas: bigint;
  try {
    gas = await client.estimateGas({ account: wallet, ...step });
  } catch {
    throw new IdentityError("transfer_simulation_failed", 409);
  }
  const gasPrice = await client.getGasPrice();
  if (nativeBalance < step.value + ((gas * 120n) / 100n) * gasPrice)
    throw new IdentityError("insufficient_gas_balance", 409);
  if (
    (await client.getBlock({ blockNumber: block.number })).hash !== block.hash
  )
    throw new IdentityError("snapshot_reorg", 503);
  return transferReviewSchema.parse({
    status: "prepared",
    action: "transfer",
    chainId,
    wallet,
    recipient,
    token,
    amount: amount.toString(),
    to: step.to,
    data: step.data,
    value: step.value.toString(),
    gas: gas.toString(),
    gasPrice: gasPrice.toString(),
    nativeBalance: nativeBalance.toString(),
    expiresAt: new Date(Date.now() + REVIEW_SECONDS * 1000).toISOString(),
    observedAt: new Date().toISOString(),
    blockNumber: block.number.toString(),
  });
}
