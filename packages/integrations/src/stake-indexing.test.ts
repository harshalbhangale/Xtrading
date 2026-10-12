import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/web/node_modules/server-only/index.js", () => ({}));

import { clearEnvioCache } from "../../../apps/web/lib/envio";
import { indexedStake } from "../../../apps/web/lib/stake-indexing";

const state = {
  chainId: 10143 as const,
  wallet: "0x1111111111111111111111111111111111111111",
  contract: "0x2222222222222222222222222222222222222222",
  token: "0x3333333333333333333333333333333333333333",
  decimals: 6 as const,
  symbol: "mUSDC" as const,
  minimum: "500000000",
  cooldown: "604800",
  balance: "500000000",
  allowance: "0",
  tokenBalance: "9500000000",
  nativeBalance: "1000000000000000000",
  withdrawableAt: "0",
  blockNumber: "1000",
  blockHash: `0x${"1".repeat(64)}`,
  blockTimestamp: "1791740130",
  observedAt: "2026-10-11T17:35:30Z",
  finality: "latest-unfinalized" as const,
};
const positionId = `10143:${state.contract}:${state.wallet}`;
function response(
  overrides: Record<string, unknown> = {},
  time = new Date().toISOString(),
) {
  return {
    data: {
      _meta: [{ progressBlock: "990", progressBlockTime: time, isReady: true }],
      StakeEvent: [
        {
          id: "10143:980:5",
          positionId,
          balance: "500000000",
          withdrawableAt: "0",
          blockNumber: "980",
          timestamp: "1791740130",
          ...overrides,
        },
      ],
    },
  };
}
function provider(value: unknown) {
  vi.stubEnv("ENVIO_GRAPHQL_URL", "http://localhost:8081/v1/graphql");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(value), { status: 200 })),
  );
}
afterEach(() => {
  clearEnvioCache();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("indexed stake evidence", () => {
  it("scopes queries to the bound wallet and keeps integer balances", async () => {
    provider(response());
    const result = await indexedStake(state);
    expect(result.status).toBe("current");
    expect(result.events[0]?.balance).toBe("500000000");
    const call = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(call?.[1]?.body as string).variables.id).toBe(positionId);
  });
  it("does not show another wallet, an imprecise number or a future block as evidence", async () => {
    for (const invalid of [
      { positionId: "other-wallet" },
      { balance: 500000000 },
      { blockNumber: "1001" },
    ]) {
      provider(response(invalid));
      expect((await indexedStake(state)).status).toBe("unavailable");
      expect((await indexedStake(state)).events).toEqual([]);
    }
  });
  it("marks stale data and RPC disagreement as lagging", async () => {
    provider(response({}, new Date(Date.now() - 180000).toISOString()));
    expect((await indexedStake(state)).status).toBe("lagging");
    provider(response({ balance: "0" }));
    expect((await indexedStake(state)).status).toBe("lagging");
  });
  it("returns unavailable without indexing credentials or after provider failure", async () => {
    vi.stubEnv("ENVIO_GRAPHQL_URL", "");
    expect((await indexedStake(state)).status).toBe("unavailable");
    provider({ errors: [{ message: "unavailable" }] });
    expect((await indexedStake(state)).status).toBe("unavailable");
  });
});
