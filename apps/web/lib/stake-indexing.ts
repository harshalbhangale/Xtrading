import "server-only";
import {
  indexedStakeSchema,
  type stakeStateSchema,
} from "@call-my-bluff/domain";

type State = Pick<
  ReturnType<typeof stakeStateSchema.parse>,
  | "chainId"
  | "contract"
  | "wallet"
  | "balance"
  | "withdrawableAt"
  | "blockNumber"
  | "blockTimestamp"
>;
export async function indexedStake(state: State) {
  const observedAt = new Date().toISOString();
  const unavailable = indexedStakeSchema.parse({
    status: "unavailable",
    observedAt,
    events: [],
  });
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  if (!endpoint || !state.contract) return unavailable;
  const positionId = `${state.chainId}:${state.contract.toLowerCase()}:${state.wallet.toLowerCase()}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ENVIO_HASURA_ADMIN_SECRET
          ? { "X-Hasura-Admin-Secret": process.env.ENVIO_HASURA_ADMIN_SECRET }
          : {}),
      },
      body: JSON.stringify({
        query: `query StakeEvidence($id: String!) {
          _meta(where: {chainId: {_eq: 10143}}) {progressBlock progressBlockTime isReady}
          StakeEvent(where: {positionId: {_eq: $id}}, order_by: [{blockNumber: desc}, {id: desc}], limit: 20) {
            id positionId balance withdrawableAt blockNumber timestamp
          }
        }`,
        variables: { id: positionId },
      }),
    });
    if (!response.ok) return unavailable;
    const result = await response.json();
    if (
      result.errors ||
      !Array.isArray(result.data?._meta) ||
      result.data._meta.length !== 1 ||
      !Array.isArray(result.data?.StakeEvent)
    )
      return unavailable;
    const meta = result.data._meta[0];
    if (
      typeof meta.progressBlockTime !== "string" ||
      typeof meta.isReady !== "boolean"
    )
      return unavailable;
    const progressBlock =
      typeof meta.progressBlock === "number" &&
      Number.isSafeInteger(meta.progressBlock)
        ? String(meta.progressBlock)
        : meta.progressBlock;
    const evidence = indexedStakeSchema.parse({
      status: "lagging",
      observedAt,
      progressBlock,
      progressBlockTime: meta.progressBlockTime,
      events: result.data.StakeEvent,
    });
    if (
      !evidence.progressBlock ||
      result.data.StakeEvent.some(
        (event: { positionId: string }) => event.positionId !== positionId,
      )
    )
      return unavailable;
    const progress = BigInt(evidence.progressBlock);
    const head = BigInt(state.blockNumber);
    if (
      progress > head ||
      evidence.events.some(
        (event) =>
          BigInt(event.blockNumber) > progress ||
          BigInt(event.timestamp) > BigInt(state.blockTimestamp),
      )
    )
      return unavailable;
    const age = Date.now() - Date.parse(meta.progressBlockTime);
    evidence.events.sort((a, b) => {
      const blockDelta = BigInt(b.blockNumber) - BigInt(a.blockNumber);
      const delta =
        blockDelta ||
        BigInt(b.id.split(":")[2] as string) -
          BigInt(a.id.split(":")[2] as string);
      return delta > 0n ? 1 : delta < 0n ? -1 : 0;
    });
    const latest = evidence.events[0];
    const matchesRpc = latest
      ? latest.balance === state.balance &&
        latest.withdrawableAt === state.withdrawableAt
      : state.balance === "0" && state.withdrawableAt === "0";
    // Indexer readiness and head proximity are freshness checks, not finality.
    evidence.status =
      meta.isReady &&
      matchesRpc &&
      Number.isFinite(age) &&
      age >= -30000 &&
      age <= 120000 &&
      head - progress <= 50n
        ? "current"
        : "lagging";
    return evidence;
  } catch {
    return unavailable;
  }
}
