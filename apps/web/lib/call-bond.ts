import "server-only";
import { calls, creators } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import {
  bondOutcomes,
  callBondStateSchema,
  callEvidenceSchema,
  preparedCallBondSchema,
} from "@call-my-bluff/domain";
import { eq } from "drizzle-orm";
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  type Hex,
  keccak256,
  parseAbi,
  stringToHex,
} from "viem";
import { getDatabase } from "./database";
import { identityContext } from "./identity-http";
import { testnetClient } from "./markets";

export const settlementAbi = parseAbi([
  "function token() view returns (address)",
  "function minBond() view returns (uint128)",
  "function maxBond() view returns (uint128)",
  "function rewardPool() view returns (uint256)",
  "function REFUND_DELAY() view returns (uint64)",
  "function claimable(address) view returns (uint256)",
  "function supportedAsset(bytes32) view returns (bool)",
  "function getCall(bytes32) view returns ((address creator, bytes32 asset, uint8 direction, uint16 targetBps, uint64 start, uint64 expiry, uint128 bond, uint128 reward, uint8 status, bytes32 termsHash, uint256 entryPrice, uint256 exitPrice))",
  "function registerCall(bytes32 callId, bytes32 asset, uint8 direction, uint16 targetBps, uint64 horizon, uint128 bond, uint128 reward, bytes32 termsHash)",
  "function claim()",
  "function refundExpired(bytes32 callId)",
]);

const MIN_HORIZON = 3600n;
// Leaves time for review and inclusion so the onchain expiry stays at or after the ledger expiry.
const INCLUSION_BUFFER = 60n;
const REVIEW_MS = 120_000;

/** Deterministic onchain ID for a registered call; never reused across calls. */
export const onchainCallId = (id: string) =>
  keccak256(stringToHex(`xtrading:call:${id}`));

export async function callBondContext(request: Request, id: string) {
  const { user, service, chainId } = await identityContext(request);
  if (chainId !== 10143) throw new IdentityError("bond_testnet_only", 409);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    user.xAccount?.xUserId !== binding.xUserId ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("current_binding_required", 403);
  if (!process.env.CALL_SETTLEMENT_ADDRESS)
    throw new IdentityError("bond_unconfigured", 503);
  const contract = getAddress(process.env.CALL_SETTLEMENT_ADDRESS);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const [row] = await database.db
    .select({
      id: calls.id,
      postId: calls.postId,
      status: calls.status,
      evidence: calls.evidence,
      xUserId: creators.xUserId,
    })
    .from(calls)
    .innerJoin(creators, eq(calls.creatorId, creators.id))
    .where(eq(calls.id, id))
    .limit(1);
  if (!row) throw new IdentityError("call_not_found", 404);
  if (row.xUserId !== binding.xUserId)
    throw new IdentityError("call_not_yours", 403);
  const evidence = callEvidenceSchema.parse(row.evidence);
  const wallet = getAddress(binding.wallet);
  const onchainId = onchainCallId(row.id);
  const asset = stringToHex(evidence.terms.assetId, { size: 32 });

  const client = testnetClient();
  if ((await client.getChainId()) !== 10143)
    throw new IdentityError("rpc_chain_mismatch", 503);
  const block = await client.getBlock();
  if (!block.hash) throw new IdentityError("rpc_unavailable", 503);
  const at = { blockNumber: block.number };
  const read = <T>(functionName: string, args: unknown[] = []) =>
    client.readContract({
      address: contract,
      abi: settlementAbi,
      functionName,
      args,
      ...at,
    } as never) as Promise<T>;
  const [
    token,
    minBond,
    maxBond,
    rewardPool,
    refundDelay,
    claimable,
    supported,
    onchain,
  ] = await Promise.all([
    read<Address>("token"),
    read<bigint>("minBond"),
    read<bigint>("maxBond"),
    read<bigint>("rewardPool"),
    read<bigint>("REFUND_DELAY"),
    read<bigint>("claimable", [wallet]),
    read<boolean>("supportedAsset", [asset]),
    read<{
      status: number;
      bond: bigint;
      reward: bigint;
      start: bigint;
      expiry: bigint;
      entryPrice: bigint;
      exitPrice: bigint;
    }>("getCall", [onchainId]),
  ]);
  const [tokenBalance, allowance, nativeBalance] = await Promise.all([
    client.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
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
    client.getBalance({ address: wallet, ...at }),
  ]);
  if ((await client.getBlock(at)).hash !== block.hash)
    throw new IdentityError("snapshot_reorg", 503);

  // The bonded window starts at inclusion and ends near the ledger expiry.
  const horizon =
    BigInt(evidence.terms.expiry) - block.timestamp - INCLUSION_BUFFER;
  const reason =
    onchain.status !== 0
      ? "already_bonded"
      : row.status !== "eligible"
        ? "call_resolved"
        : !supported
          ? "asset_not_bondable"
          : horizon < MIN_HORIZON
            ? "window_too_short"
            : null;
  const status = onchain.status === 0 ? null : bondOutcomes[onchain.status - 1];
  const state = callBondStateSchema.parse({
    callId: row.id,
    onchainId,
    chainId: 10143,
    contract,
    token: getAddress(token),
    wallet,
    bondable: reason === null,
    reason,
    horizon: reason === null ? horizon.toString() : null,
    minBond: minBond.toString(),
    maxBond: maxBond.toString(),
    rewardPool: rewardPool.toString(),
    tokenBalance: tokenBalance.toString(),
    allowance: allowance.toString(),
    nativeBalance: nativeBalance.toString(),
    claimable: claimable.toString(),
    refundableAt:
      status === "open" ? (onchain.expiry + refundDelay).toString() : null,
    onchain: status
      ? {
          status,
          bond: onchain.bond.toString(),
          reward: onchain.reward.toString(),
          start: onchain.start.toString(),
          expiry: onchain.expiry.toString(),
          entryPrice: onchain.entryPrice.toString(),
          exitPrice: onchain.exitPrice.toString(),
        }
      : null,
    blockNumber: block.number.toString(),
    blockTimestamp: block.timestamp.toString(),
    observedAt: new Date().toISOString(),
  });
  return { client, state, evidence, asset, postId: row.postId };
}

export async function prepareCallBond(
  request: Request,
  id: string,
  action: "bond" | "claim" | "refund",
) {
  if (action === "bond") throw new IdentityError("call_bonds_retired", 409);
  const { client, state } = await callBondContext(request, id);
  const contract = state.contract as Address;
  let to = contract,
    data: Hex,
    step: "claim" | "refund";
  if (action === "claim") {
    if (BigInt(state.claimable) === 0n)
      throw new IdentityError("nothing_to_claim", 409);
    step = "claim";
    data = encodeFunctionData({ abi: settlementAbi, functionName: "claim" });
  } else {
    if (
      !state.refundableAt ||
      BigInt(state.blockTimestamp) < BigInt(state.refundableAt)
    )
      throw new IdentityError("not_refundable", 409);
    step = "refund";
    data = encodeFunctionData({
      abi: settlementAbi,
      functionName: "refundExpired",
      args: [state.onchainId as Hex],
    });
  }
  if (BigInt(state.nativeBalance) === 0n)
    throw new IdentityError("test_mon_required", 409);
  let gas: bigint;
  try {
    // Executes the unsigned request against current state; the server never signs.
    gas = await client.estimateGas({
      account: state.wallet as Address,
      to,
      data,
      value: 0n,
    });
  } catch {
    throw new IdentityError("bond_simulation_failed", 409);
  }
  return preparedCallBondSchema.parse({
    action: step,
    chainId: 10143,
    wallet: state.wallet,
    to,
    data,
    value: "0",
    gas: gas.toString(),
    expiresAt: new Date(Date.now() + REVIEW_MS).toISOString(),
    bond: null,
    reward: null,
    termsHash: null,
    state,
  });
}
