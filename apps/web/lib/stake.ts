import "server-only";
import { IdentityError } from "@call-my-bluff/database/identity";
import { preparedStakeSchema, stakeStateSchema } from "@call-my-bluff/domain";
import {
  depositStep,
  stakeAbi,
  stakeUnits,
  testnetStake,
} from "@call-my-bluff/integrations/stake";
import {
  type Address,
  createPublicClient,
  encodeDeployData,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Hex,
  http,
  parseAbi,
} from "viem";
import { monadTestnet } from "viem/chains";
import deployment from "../../../packages/integrations/abi/CreatorStake-deployment.json";
import mockDeployment from "../../../packages/integrations/abi/MockUSDC-deployment.json";
import { identityContext } from "./identity-http";

export async function stakeContext(request: Request) {
  const { user, service, chainId } = await identityContext(request);
  if (chainId !== 10143) throw new IdentityError("stake_testnet_only", 409);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    user.xAccount?.xUserId !== binding.xUserId ||
    user.xAccount.handle !== binding.handle ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("current_binding_required", 403);
  const rpc = process.env.MONAD_RPC_URL;
  if (!rpc) throw new IdentityError("rpc_unconfigured", 503);
  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(rpc, { timeout: 15000, retryCount: 0 }),
  });
  if ((await client.getChainId()) !== 10143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const wallet = getAddress(binding.wallet);
  const contract = process.env.CREATOR_STAKE_ADDRESS
    ? getAddress(process.env.CREATOR_STAKE_ADDRESS)
    : null;
  const block = await client.getBlock();
  if (!block.hash) throw new IdentityError("rpc_unavailable", 503);
  const at = { blockNumber: block.number };
  const mode = process.env.STAKE_TOKEN_MODE ?? "circle";
  if (!["circle", "mock"].includes(mode))
    throw new IdentityError("stake_token_mode_invalid", 503);
  if (mode === "mock" && !process.env.MOCK_USDC_ADDRESS)
    throw new IdentityError("mock_token_unconfigured", 503);
  const token =
    mode === "mock"
      ? getAddress(process.env.MOCK_USDC_ADDRESS as string)
      : testnetStake.token;
  const expectedSymbol = mode === "mock" ? "mUSDC" : "USDC";
  const [decimals, symbol, tokenBalance, nativeBalance] = await Promise.all([
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
      ...at,
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
      ...at,
    }),
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
      ...at,
    }),
    client.getBalance({ address: wallet, ...at }),
  ]);
  if (decimals !== 6 || symbol !== expectedSymbol)
    throw new IdentityError("stake_token_mismatch", 503);
  let balance = 0n,
    allowance = 0n,
    withdrawableAt = 0n;
  if (contract) {
    if (!(await client.getCode({ address: contract, ...at })))
      throw new IdentityError("stake_contract_missing", 503);
    const [actualToken, minimum, cooldown, locked, unlock, approved] =
      await Promise.all([
        client.readContract({
          address: contract,
          abi: stakeAbi,
          functionName: "token",
          ...at,
        }),
        client.readContract({
          address: contract,
          abi: stakeAbi,
          functionName: "minimumStake",
          ...at,
        }),
        client.readContract({
          address: contract,
          abi: stakeAbi,
          functionName: "withdrawalDelay",
          ...at,
        }),
        client.readContract({
          address: contract,
          abi: stakeAbi,
          functionName: "balanceOf",
          args: [wallet],
          ...at,
        }),
        client.readContract({
          address: contract,
          abi: stakeAbi,
          functionName: "withdrawableAt",
          args: [wallet],
          ...at,
        }),
        client.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [wallet, contract],
          ...at,
        }),
      ]);
    if (
      actualToken.toLowerCase() !== token.toLowerCase() ||
      minimum !== testnetStake.minimum ||
      cooldown !== testnetStake.cooldown
    )
      throw new IdentityError("stake_configuration_mismatch", 503);
    balance = locked;
    withdrawableAt = unlock;
    allowance = approved;
  }
  // Detect a reorg during the multi-read snapshot rather than publishing mixed evidence.
  if ((await client.getBlock(at)).hash !== block.hash)
    throw new IdentityError("snapshot_reorg", 503);
  const state = stakeStateSchema.parse({
    chainId: 10143,
    wallet,
    token,
    decimals,
    symbol,
    contract,
    minimum: testnetStake.minimum.toString(),
    cooldown: testnetStake.cooldown.toString(),
    balance: balance.toString(),
    allowance: allowance.toString(),
    withdrawableAt: withdrawableAt.toString(),
    tokenBalance: tokenBalance.toString(),
    nativeBalance: nativeBalance.toString(),
    blockNumber: block.number.toString(),
    blockHash: block.hash,
    blockTimestamp: block.timestamp.toString(),
    observedAt: new Date().toISOString(),
    finality: "latest-unfinalized",
  });
  return { client, state, wallet };
}
export async function prepareStake(
  request: Request,
  action: string,
  amount?: string,
) {
  const { client, state, wallet } = await stakeContext(request);
  let to: Address | null = state.contract as Address | null,
    data: Hex,
    actualAction = action;
  if (action === "deployMockUSDC") {
    if (state.symbol === "mUSDC")
      throw new IdentityError("mock_already_configured", 409);
    to = null;
    data = encodeDeployData({
      abi: parseAbi(["constructor(address recipient)"]),
      bytecode: mockDeployment.bytecode as Hex,
      args: [wallet],
    });
  } else if (action === "deploy") {
    if (to) throw new IdentityError("stake_already_configured", 409);
    data = encodeDeployData({
      abi: parseAbi([
        "constructor(address token_, uint256 minimumStake_, uint256 withdrawalDelay_)",
      ]),
      bytecode: deployment.bytecode as Hex,
      args: [
        state.token as Address,
        testnetStake.minimum,
        testnetStake.cooldown,
      ],
    });
  } else {
    if (!to) throw new IdentityError("stake_not_deployed", 409);
    if (action === "deposit") {
      let units: bigint;
      try {
        units = stakeUnits(amount ?? "", 6);
      } catch {
        throw new IdentityError("invalid_amount");
      }
      if (BigInt(state.withdrawableAt) > 0n)
        throw new IdentityError("withdrawal_pending", 409);
      if (units > BigInt(state.tokenBalance))
        throw new IdentityError("insufficient_test_usdc", 409);
      const step = depositStep(
        state.token as Address,
        to,
        units,
        BigInt(state.allowance),
      );
      to = step.to;
      data = step.data;
      actualAction = step.action;
    } else {
      if (
        action === "requestWithdrawal" &&
        (BigInt(state.balance) === 0n || BigInt(state.withdrawableAt) > 0n)
      )
        throw new IdentityError("no_requestable_stake", 409);
      if (action === "cancelWithdrawal" && BigInt(state.withdrawableAt) === 0n)
        throw new IdentityError("no_withdrawal", 409);
      if (
        action === "withdraw" &&
        (BigInt(state.withdrawableAt) === 0n ||
          BigInt(state.blockTimestamp) < BigInt(state.withdrawableAt))
      )
        throw new IdentityError("cooldown_active", 409);
      data = encodeFunctionData({
        abi: stakeAbi,
        functionName: action as
          | "requestWithdrawal"
          | "cancelWithdrawal"
          | "withdraw",
      });
    }
  }
  if (BigInt(state.nativeBalance) === 0n)
    throw new IdentityError("test_mon_required", 409);
  // eth_estimateGas executes the unsigned request against current state; no server signing.
  const gas = await client.estimateGas({
    account: wallet,
    ...(to ? { to } : {}),
    data,
    value: 0n,
  });
  return preparedStakeSchema.parse({
    action: actualAction,
    chainId: 10143,
    wallet,
    to,
    data,
    value: "0",
    gas: gas.toString(),
    expiresAt: new Date(Date.now() + 120000).toISOString(),
    state,
  });
}
