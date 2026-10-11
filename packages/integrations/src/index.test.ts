import { describe, expect, it } from "vitest";
import { getMonadChain, integrationStatus } from "./index";
import { createNansenClient } from "./nansen";

describe("provider boundaries", () => {
  it("defaults to testnet and rejects accidental network changes", () => {
    expect(getMonadChain(undefined).id).toBe(10143);
    expect(() => getMonadChain(1)).toThrow();
  });
  it("exposes configuration status without credentials or claiming live integration", () => {
    const secret = "sensitive-example-key";
    const result = integrationStatus({ NANSEN_API_KEY: secret });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.every((item) => item.implementation === "foundation")).toBe(
      true,
    );
  });
  it("does not leak a provider error response", async () => {
    const fetcher: typeof fetch = async () =>
      new Response("secret upstream response", { status: 401 });
    await expect(
      createNansenClient("test", fetcher).post("/api/v1/tgm/holders", {}),
    ).rejects.toThrow("Nansen request failed (401)");
  });
});
