import "server-only";
import { creators } from "@call-my-bluff/database";
import {
  normalizeHandle,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import { stakeAbi, testnetStake } from "@call-my-bluff/integrations/stake";
import { desc, eq } from "drizzle-orm";
import { createPublicClient, erc20Abi, getAddress, http } from "viem";
import { monadTestnet } from "viem/chains";
import { getDatabase } from "./database";
import { indexedStake } from "./stake-indexing";

/** Most recently bound handles. `null` means the registry itself is unavailable. */
export async function recentBoundHandles(limit = 12) {
  const database = getDatabase();
  if (!database) return null;
  try {
    const rows = await database.db
      .select({ handle: creators.handle })
      .from(creators)
      .orderBy(desc(creators.linkedAt))
      .limit(limit);
    return [...new Set(rows.map((row) => row.handle))];
  } catch {
    return null;
  }
}

export async function publicCreatorEvidence(input: string) {
  const handle = normalizeHandle(input);
  if (!handle) return null;
  const result = publicCreatorEvidenceSchema.parse({
    handle,
    identity: { status: "unavailable" },
    stake: { status: "unavailable", chainId: 10143 },
    observedAt: new Date().toISOString(),
  });
  const database = getDatabase();
  if (!database) return result;
  const rows = await database.db
    .select({
      xUserId: creators.xUserId,
      wallet: creators.wallet,
      linkedAt: creators.linkedAt,
    })
    .from(creators)
    .where(eq(creators.handle, handle))
    .limit(2);
  // A handle is only a lookup hint. Never choose between ambiguous stable-ID bindings.
  if (rows.length !== 1 || !rows[0]) return result;
  const binding = rows[0];
  result.identity = {
    status: "bound",
    xUserId: binding.xUserId,
    wallet: binding.wallet,
    linkedAt: binding.linkedAt.toISOString(),
  };
  const address = process.env.CREATOR_STAKE_ADDRESS;
  const rpc = process.env.MONAD_RPC_URL;
  if (!address || !rpc || process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "10143")
    return result;
  try {
    const contract = getAddress(address),
      wallet = getAddress(binding.wallet);
    const client = createPublicClient({
      chain: monadTestnet,
      transport: http(rpc, { timeout: 5000, retryCount: 0 }),
    });
    if ((await client.getChainId()) !== 10143) return result;
    const block = await client.getBlock();
    if (!block.hash) return result;
    const at = { blockNumber: block.number };
    const [token, minimum, delay, balance, unlock] = await Promise.all([
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
    ]);
    const mode = process.env.STAKE_TOKEN_MODE ?? "circle";
    const expectedToken =
      mode === "mock" ? process.env.MOCK_USDC_ADDRESS : testnetStake.token;
    if (
      !["mock", "circle"].includes(mode) ||
      !expectedToken ||
      token.toLowerCase() !== expectedToken.toLowerCase() ||
      minimum !== testnetStake.minimum ||
      delay !== testnetStake.cooldown
    )
      return result;
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "symbol",
        ...at,
      }),
      client.readContract({
        address: token,
        abi: erc20Abi,
        functionName: "decimals",
        ...at,
      }),
    ]);
    if (
      decimals !== 6 ||
      symbol !== (mode === "mock" ? "mUSDC" : "USDC") ||
      (await client.getBlock(at)).hash !== block.hash
    )
      return result;
    const indexing = await indexedStake({
      chainId: 10143,
      contract,
      wallet,
      balance: balance.toString(),
      withdrawableAt: unlock.toString(),
      blockNumber: block.number.toString(),
      blockTimestamp: block.timestamp.toString(),
    });
    result.stake = {
      status:
        indexing.status !== "current"
          ? "unavailable"
          : unlock > 0n
            ? "withdrawal-pending"
            : balance >= minimum
              ? "active"
              : "inactive",
      chainId: 10143,
      contract,
      token,
      symbol,
      balance: balance.toString(),
      withdrawableAt: unlock.toString(),
      indexing,
    };
    return publicCreatorEvidenceSchema.parse(result);
  } catch {
    return result;
  }
}
