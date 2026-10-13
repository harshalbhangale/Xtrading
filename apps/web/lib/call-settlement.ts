import "server-only";
import { calls, creators } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import { callEvidenceSchema } from "@call-my-bluff/domain";
import { eq } from "drizzle-orm";
import {
  type Address,
  encodeFunctionData,
  getAddress,
  type Hex,
  keccak256,
  parseAbi,
  stringToHex,
} from "viem";
import { getDatabase } from "./database";
import { identityContext } from "./identity-http";
import { testnetClient } from "./markets";

/** Deterministic onchain ID for a registered call; never reused across calls. */
export const onchainCallId = (id: string) =>
  keccak256(stringToHex(`xtrading:call:${id}`));

const scorecardAbi = parseAbi([
  "function minBond() view returns (uint128)",
  "function maxBond() view returns (uint128)",
  "function supportedAsset(bytes32) view returns (bool)",
  "function getCall(bytes32) view returns ((address creator, bytes32 asset, uint8 direction, uint16 targetBps, uint64 start, uint64 expiry, uint128 bond, uint128 reward, uint8 status, bytes32 termsHash, uint256 entryPrice, uint256 exitPrice))",
  "function registerCall(bytes32 callId, bytes32 asset, uint8 direction, uint16 targetBps, uint64 horizon, uint128 bond, uint128 reward, bytes32 termsHash)",
]);
const statuses = [
  null,
  "open",
  "success",
  "failure",
  "tie",
  "refunded",
] as const;
const MIN_HORIZON = 3600n;
// Leaves time for review and inclusion so the onchain expiry stays at or after the ledger expiry.
const INCLUSION_BUFFER = 60n;

/**
 * Chainlink CRE scorecard state for one of the signed-in creator's calls.
 * The contract is bond-free (minBond = maxBond = 0): recording moves no
 * tokens, it only commits the call so the workflow settles its outcome.
 */
export async function callSettlementContext(request: Request, id: string) {
  const { user, service } = await identityContext(request);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    user.xAccount?.xUserId !== binding.xUserId ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet)
  )
    throw new IdentityError("current_binding_required", 403);
  if (!process.env.CALL_SETTLEMENT_ADDRESS)
    throw new IdentityError("settlement_unconfigured", 503);
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
  const at = { blockNumber: block.number };
  const [maxBond, supported, onchain, nativeBalance] = await Promise.all([
    client.readContract({
      address: contract,
      abi: scorecardAbi,
      functionName: "maxBond",
      ...at,
    }),
    client.readContract({
      address: contract,
      abi: scorecardAbi,
      functionName: "supportedAsset",
      args: [asset],
      ...at,
    }),
    client.readContract({
      address: contract,
      abi: scorecardAbi,
      functionName: "getCall",
      args: [onchainId],
      ...at,
    }),
    client.getBalance({ address: wallet, ...at }),
  ]);
  // Refuse a bonded deployment: this flow must never move creator funds.
  if (maxBond !== 0n) throw new IdentityError("settlement_not_bond_free", 503);
  const horizon =
    BigInt(evidence.terms.expiry) - block.timestamp - INCLUSION_BUFFER;
  const status = statuses[onchain.status] ?? null;
  const reason = status
    ? "already_recorded"
    : row.status !== "eligible"
      ? "call_resolved"
      : !supported
        ? "asset_not_supported"
        : horizon < MIN_HORIZON
          ? "window_too_short"
          : null;
  return {
    client,
    evidence,
    asset,
    postId: row.postId,
    state: {
      callId: row.id,
      onchainId,
      chainId: 10143 as const,
      contract,
      wallet,
      recordable: reason === null,
      reason,
      horizon: reason === null ? horizon.toString() : null,
      nativeBalance: nativeBalance.toString(),
      onchain: status
        ? {
            status,
            start: onchain.start.toString(),
            expiry: onchain.expiry.toString(),
            entryPrice: onchain.entryPrice.toString(),
            exitPrice: onchain.exitPrice.toString(),
          }
        : null,
      blockNumber: block.number.toString(),
      observedAt: new Date().toISOString(),
    },
  };
}
export type CallSettlementState = Awaited<
  ReturnType<typeof callSettlementContext>
>["state"];

/** One unsigned registerCall with zero bond and reward; the creator's wallet signs. */
export async function prepareCallRecord(request: Request, id: string) {
  const { client, evidence, asset, postId, state } =
    await callSettlementContext(request, id);
  if (!state.recordable || !state.horizon)
    throw new IdentityError(state.reason ?? "not_recordable", 409);
  if (BigInt(state.nativeBalance) === 0n)
    throw new IdentityError("test_mon_required", 409);
  const data = encodeFunctionData({
    abi: scorecardAbi,
    functionName: "registerCall",
    args: [
      state.onchainId as Hex,
      asset,
      evidence.terms.direction === "up" ? 0 : 1,
      Number(evidence.terms.targetBps),
      BigInt(state.horizon),
      0n,
      0n,
      keccak256(stringToHex(JSON.stringify({ postId, terms: evidence.terms }))),
    ],
  });
  let gas: bigint;
  try {
    gas = await client.estimateGas({
      account: state.wallet as Address,
      to: state.contract as Address,
      data,
      value: 0n,
    });
  } catch {
    throw new IdentityError("record_simulation_failed", 409);
  }
  return {
    to: state.contract,
    data,
    gas: gas.toString(),
    chainId: 10143 as const,
    wallet: state.wallet,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    state,
  };
}
export type PreparedCallRecord = Awaited<ReturnType<typeof prepareCallRecord>>;
