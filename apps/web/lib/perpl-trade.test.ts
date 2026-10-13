import {
  PERPL_MAINNET,
  PERPL_TESTNET,
} from "@call-my-bluff/integrations/perpl-exchange";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./identity-http", () => ({ identityContext: vi.fn() }));
const {
  perpAccount,
  perpLimits,
  perpRequestSchema,
  preparePerp,
  preparePerpWithdraw,
} = await import("./perpl-trade");

const order = {
  marketId: 20,
  side: "long" as const,
  size: "0.01",
  leverage: 2,
  slippageBps: 100,
  sourcePostId: null,
};
// A session context that must never be reached when the network is refused first.
const unreachable = vi.fn(async () => {
  throw new Error("context should not be called");
}) as never;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Perpl network selection", () => {
  it("defaults to testnet and accepts only testnet or mainnet", () => {
    expect(perpRequestSchema.parse(order).chainId).toBe(10143);
    expect(perpRequestSchema.parse({ ...order, chainId: 143 }).chainId).toBe(
      143,
    );
    expect(perpRequestSchema.safeParse({ ...order, chainId: 1 }).success).toBe(
      false,
    );
  });

  it("refuses mainnet unless the server enables it, before reading the session", async () => {
    vi.stubEnv("PERPL_MAINNET_ENABLED", "");
    await expect(
      preparePerp(
        new Request("http://x"),
        { ...order, chainId: 143 },
        unreachable,
      ),
    ).rejects.toMatchObject({ code: "perpl_mainnet_disabled" });
    await expect(
      perpAccount(new Request("http://x"), 143, unreachable),
    ).rejects.toMatchObject({ code: "perpl_mainnet_disabled" });
  });

  it("rejects unknown chains", async () => {
    await expect(
      perpAccount(new Request("http://x"), 1, unreachable),
    ).rejects.toMatchObject({ code: "unsupported_chain" });
  });

  it("keeps testnet orders on a testnet deployment", async () => {
    const mainnetDeployment = vi.fn(async () => ({
      user: { privyUserId: "u", wallets: [] },
      service: {},
      chainId: 143,
    })) as never;
    await expect(
      preparePerpWithdraw(
        new Request("http://x"),
        { chainId: 10143, amount: "1" },
        mainnetDeployment,
      ),
    ).rejects.toMatchObject({ code: "trading_testnet_only" });
  });
});

describe("Perpl caps", () => {
  it("uses lower mainnet defaults with a margin cap", () => {
    vi.stubEnv("PERPL_MAX_LEVERAGE", "");
    vi.stubEnv("PERPL_MAX_SIZE", "");
    vi.stubEnv("PERPL_MAINNET_MAX_LEVERAGE", "");
    vi.stubEnv("PERPL_MAINNET_MAX_SIZE", "");
    vi.stubEnv("PERPL_MAINNET_MAX_COLLATERAL", "");
    expect(perpLimits(PERPL_TESTNET)).toEqual({
      maxLeverage: 5,
      maxSize: "1",
      maxCollateral: null,
    });
    expect(perpLimits(PERPL_MAINNET)).toEqual({
      maxLeverage: 3,
      maxSize: null,
      maxCollateral: "50",
    });
  });

  it("reads mainnet caps from their own variables and ignores bad leverage", () => {
    vi.stubEnv("PERPL_MAX_LEVERAGE", "10");
    vi.stubEnv("PERPL_MAINNET_MAX_LEVERAGE", "2");
    vi.stubEnv("PERPL_MAINNET_MAX_SIZE", "0.5");
    vi.stubEnv("PERPL_MAINNET_MAX_COLLATERAL", "20");
    expect(perpLimits(PERPL_MAINNET)).toEqual({
      maxLeverage: 2,
      maxSize: "0.5",
      maxCollateral: "20",
    });
    vi.stubEnv("PERPL_MAINNET_MAX_LEVERAGE", "99");
    expect(perpLimits(PERPL_MAINNET).maxLeverage).toBe(3);
  });
});
