import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createDatabase } from "./client";
import { identityService, type VerifiedIdentity } from "./identity";
import { creators, walletChallenges } from "./schema";

const testUrl = process.env.IDENTITY_TEST_DATABASE_URL;
if (
  testUrl &&
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(testUrl).hostname)
)
  throw new Error("Identity fixtures are restricted to local test databases.");
const connection = testUrl ? createDatabase(testUrl) : undefined;
const service = connection ? identityService(connection.db) : undefined;
function testDatabase() {
  if (!connection) throw new Error("Local test database required");
  return connection;
}
function testService() {
  if (!service) throw new Error("Local test database required");
  return service;
}
const ids: string[] = [];
function fixture() {
  const account = privateKeyToAccount(generatePrivateKey());
  const identity: VerifiedIdentity = {
    privyUserId: `did:privy:test-${randomUUID()}`,
    xUserId: BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString(),
    handle: "test_identity",
    wallets: [account.address],
  };
  ids.push(identity.privyUserId);
  return { account, identity };
}
const origin = "http://localhost:3000",
  chain = 10143;

describe.skipIf(!connection)("persistent binding security", () => {
  afterEach(async () => {
    if (connection && ids.length) {
      await connection.db
        .delete(creators)
        .where(inArray(creators.privyUserId, ids));
      await connection.db
        .delete(walletChallenges)
        .where(inArray(walletChallenges.privyUserId, ids));
      ids.length = 0;
    }
  });
  afterAll(async () => {
    await connection?.sql.end();
  });
  it("persists one binding and rejects replay", async () => {
    const { account, identity } = fixture();
    const challenge = await testService().issue(
      identity,
      account.address,
      origin,
      chain,
    );
    const signature = await account.signMessage({ message: challenge.message });
    await expect(
      testService().bind(
        identity,
        challenge.challengeId,
        signature,
        origin,
        chain,
      ),
    ).resolves.toMatchObject({
      xUserId: identity.xUserId,
      wallet: account.address.toLowerCase(),
    });
    expect(await testService().current(identity.privyUserId)).toMatchObject({
      xUserId: identity.xUserId,
    });
    await expect(
      testService().bind(
        identity,
        challenge.challengeId,
        signature,
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "challenge_expired_or_used" });
  });
  it("rejects cross-account, changed identity, wrong network and forged signatures", async () => {
    const { account, identity } = fixture();
    const other = fixture();
    const challenge = await testService().issue(
      identity,
      account.address,
      origin,
      chain,
    );
    const signature = await account.signMessage({ message: challenge.message });
    await expect(
      testService().bind(
        other.identity,
        challenge.challengeId,
        signature,
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "challenge_expired_or_used" });
    await expect(
      testService().bind(
        { ...identity, xUserId: "99999" },
        challenge.challengeId,
        signature,
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "identity_changed" });
    await expect(
      testService().bind(
        identity,
        challenge.challengeId,
        signature,
        origin,
        143,
      ),
    ).rejects.toMatchObject({ code: "identity_changed" });
    await expect(
      testService().bind(
        identity,
        challenge.challengeId,
        await other.account.signMessage({ message: challenge.message }),
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "invalid_wallet_proof" });
    expect(await testService().current(identity.privyUserId)).toBeNull();
  });
  it("rejects expired challenges and unlinked wallets", async () => {
    const { account, identity } = fixture();
    await expect(
      testService().issue(
        { ...identity, wallets: [] },
        account.address,
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "wallet_not_linked" });
    const challenge = await testService().issue(
      identity,
      account.address,
      origin,
      chain,
    );
    await testDatabase()
      .db.update(walletChallenges)
      .set({ expiresAt: new Date(0) })
      .where(eq(walletChallenges.id, challenge.challengeId));
    await expect(
      testService().bind(
        identity,
        challenge.challengeId,
        await account.signMessage({ message: challenge.message }),
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "challenge_expired_or_used" });
  });
  it("serializes concurrent replay so only one request succeeds", async () => {
    const { account, identity } = fixture();
    const challenge = await testService().issue(
      identity,
      account.address,
      origin,
      chain,
    );
    const signature = await account.signMessage({ message: challenge.message });
    const results = await Promise.allSettled([
      testService().bind(
        identity,
        challenge.challengeId,
        signature,
        origin,
        chain,
      ),
      testService().bind(
        identity,
        challenge.challengeId,
        signature,
        origin,
        chain,
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("keeps an existing wallet binding when another user tries to claim it", async () => {
    const first = fixture(),
      second = fixture();
    const challenge = await testService().issue(
      first.identity,
      first.account.address,
      origin,
      chain,
    );
    await testService().bind(
      first.identity,
      challenge.challengeId,
      await first.account.signMessage({ message: challenge.message }),
      origin,
      chain,
    );
    const competing = { ...second.identity, wallets: [first.account.address] };
    const next = await testService().issue(
      competing,
      first.account.address,
      origin,
      chain,
    );
    await expect(
      testService().bind(
        competing,
        next.challengeId,
        await first.account.signMessage({ message: next.message }),
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "binding_conflict" });
    expect(await testService().current(second.identity.privyUserId)).toBeNull();
  });
  it("limits issuance and invalidates replaced nonces", async () => {
    const { account, identity } = fixture();
    const first = await testService().issue(
      identity,
      account.address,
      origin,
      chain,
    );
    await expect(
      testService().issue(identity, account.address, origin, chain),
    ).rejects.toMatchObject({ code: "challenge_rate_limited" });
    await testDatabase()
      .db.update(walletChallenges)
      .set({ issuedAt: new Date(Date.now() - 11000) })
      .where(eq(walletChallenges.id, first.challengeId));
    const second = await testService().issue(
      identity,
      account.address,
      origin,
      chain,
    );
    expect(second.challengeId).not.toBe(first.challengeId);
    await expect(
      testService().bind(
        identity,
        first.challengeId,
        await account.signMessage({ message: first.message }),
        origin,
        chain,
      ),
    ).rejects.toMatchObject({ code: "challenge_expired_or_used" });
  });
});
