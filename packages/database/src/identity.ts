import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getAddress, type Hex, verifyMessage } from "viem";
import type { createDatabase } from "./client";
import { creators, walletChallenges } from "./schema";

export type VerifiedIdentity = {
  privyUserId: string;
  xUserId: string;
  handle: string;
  wallets: string[];
};
export class IdentityError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(code);
  }
}
export function bindingMessage(input: {
  origin: string;
  wallet: string;
  xUserId: string;
  privyUserId: string;
  chainId: number;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}) {
  return `${new URL(input.origin).host} requests a Call My Bluff identity binding.\n\nWallet: ${getAddress(input.wallet)}\nX user ID: ${input.xUserId}\nSession owner: ${input.privyUserId}\nOrigin: ${input.origin}\nChain ID: ${input.chainId}\nNonce: ${input.nonce}\nIssued at: ${input.issuedAt.toISOString()}\nExpires at: ${input.expiresAt.toISOString()}\n\nThis proves account-to-wallet ownership. It authorizes no transaction, stake, token approval or trade.`;
}
export async function verifyWalletProof(
  wallet: string,
  message: string,
  signature: Hex,
) {
  try {
    return await verifyMessage({
      address: getAddress(wallet),
      message,
      signature,
    });
  } catch {
    return false;
  }
}
export function identityService(db: ReturnType<typeof createDatabase>["db"]) {
  return {
    async issue(
      identity: VerifiedIdentity,
      wallet: string,
      origin: string,
      chainId: number,
    ) {
      const normalized = getAddress(wallet).toLowerCase();
      if (!identity.wallets.some((w) => w.toLowerCase() === normalized))
        throw new IdentityError("wallet_not_linked", 403);
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${identity.privyUserId}, 0))`,
        );
        const now = new Date();
        const [old] = await tx
          .select()
          .from(walletChallenges)
          .where(eq(walletChallenges.privyUserId, identity.privyUserId));
        if (old && now.getTime() - old.issuedAt.getTime() < 10_000)
          throw new IdentityError("challenge_rate_limited", 429);
        const sameWindow =
          old && now.getTime() - old.windowStartedAt.getTime() < 3_600_000;
        const count = sameWindow ? old.windowCount + 1 : 1;
        if (count > 30) throw new IdentityError("challenge_rate_limited", 429);
        const id = randomUUID();
        const expiresAt = new Date(now.getTime() + 300_000);
        const message = bindingMessage({
          ...identity,
          wallet: normalized,
          origin,
          chainId,
          nonce: randomBytes(32).toString("hex"),
          issuedAt: now,
          expiresAt,
        });
        const values = {
          id,
          privyUserId: identity.privyUserId,
          xUserId: identity.xUserId,
          handle: identity.handle,
          wallet: normalized,
          origin,
          chainId,
          message,
          issuedAt: now,
          expiresAt,
          consumedAt: null,
          windowStartedAt: sameWindow ? old.windowStartedAt : now,
          windowCount: count,
        };
        await tx.insert(walletChallenges).values(values).onConflictDoUpdate({
          target: walletChallenges.privyUserId,
          set: values,
        });
        return {
          challengeId: id,
          message,
          wallet: normalized,
          expiresAt: expiresAt.toISOString(),
        };
      });
    },
    async bind(
      identity: VerifiedIdentity,
      id: string,
      signature: Hex,
      origin: string,
      chainId: number,
    ) {
      try {
        return await db.transaction(async (tx) => {
          const [challenge] = await tx
            .select()
            .from(walletChallenges)
            .where(
              and(
                eq(walletChallenges.id, id),
                eq(walletChallenges.privyUserId, identity.privyUserId),
              ),
            )
            .for("update");
          if (
            !challenge ||
            challenge.consumedAt ||
            challenge.expiresAt.getTime() <= Date.now()
          )
            throw new IdentityError("challenge_expired_or_used", 409);
          if (
            challenge.origin !== origin ||
            challenge.chainId !== chainId ||
            challenge.xUserId !== identity.xUserId ||
            challenge.handle !== identity.handle ||
            !identity.wallets.some((w) => w.toLowerCase() === challenge.wallet)
          )
            throw new IdentityError("identity_changed", 409);
          if (
            !(await verifyWalletProof(
              challenge.wallet,
              challenge.message,
              signature,
            ))
          )
            throw new IdentityError("invalid_wallet_proof", 403);
          const conflicts = await tx
            .select()
            .from(creators)
            .where(
              or(
                eq(creators.privyUserId, identity.privyUserId),
                eq(creators.xUserId, identity.xUserId),
                eq(creators.wallet, challenge.wallet),
              ),
            )
            .for("update");
          if (
            conflicts.some(
              (c) =>
                c.privyUserId !== identity.privyUserId ||
                c.xUserId !== identity.xUserId ||
                c.wallet !== challenge.wallet,
            )
          )
            throw new IdentityError("binding_conflict", 409);
          const [consumed] = await tx
            .update(walletChallenges)
            .set({ consumedAt: new Date() })
            .where(
              and(
                eq(walletChallenges.id, id),
                isNull(walletChallenges.consumedAt),
                gt(walletChallenges.expiresAt, sql`now()`),
              ),
            )
            .returning({ id: walletChallenges.id });
          if (!consumed)
            throw new IdentityError("challenge_expired_or_used", 409);
          const [record] = conflicts.length
            ? await tx
                .update(creators)
                .set({ handle: identity.handle })
                .where(eq(creators.privyUserId, identity.privyUserId))
                .returning()
            : await tx
                .insert(creators)
                .values({
                  privyUserId: identity.privyUserId,
                  xUserId: identity.xUserId,
                  handle: identity.handle,
                  wallet: challenge.wallet,
                  linkedAt: new Date(),
                })
                .returning();
          if (!record) throw new IdentityError("binding_failed", 503);
          return {
            xUserId: record.xUserId,
            handle: record.handle,
            wallet: record.wallet,
            linkedAt: record.linkedAt.toISOString(),
          };
        });
      } catch (error) {
        if (error instanceof IdentityError) throw error;
        // Concurrent users racing for one wallet/X ID are constrained by database uniqueness.
        const code =
          (error as { code?: string; cause?: { code?: string } }).code ??
          (error as { cause?: { code?: string } }).cause?.code;
        if (code === "23505") throw new IdentityError("binding_conflict", 409);
        throw error;
      }
    },
    async current(privyUserId: string) {
      const [record] = await db
        .select()
        .from(creators)
        .where(eq(creators.privyUserId, privyUserId));
      return record
        ? {
            xUserId: record.xUserId,
            handle: record.handle,
            wallet: record.wallet,
            linkedAt: record.linkedAt.toISOString(),
          }
        : null;
    },
  };
}
