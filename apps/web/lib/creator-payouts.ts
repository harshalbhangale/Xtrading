import "server-only";
import { creatorPayouts, creators } from "@call-my-bluff/database";
import { IdentityError } from "@call-my-bluff/database/identity";
import { and, eq, sql } from "drizzle-orm";
import { type Address, getAddress } from "viem";
import { getDatabase } from "./database";
import { identityContext } from "./identity-http";

export async function payoutRegistration(request: Request, enabled?: boolean) {
  const { user, service } = await identityContext(request);
  const binding = await service.current(user.privyUserId);
  if (
    !binding ||
    binding.xUserId !== user.xAccount?.xUserId ||
    !user.wallets.some((w) => w.toLowerCase() === binding.wallet.toLowerCase())
  )
    throw new IdentityError("current_binding_required", 403);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  if (enabled !== undefined) {
    await database.db
      .insert(creatorPayouts)
      .values({ xUserId: binding.xUserId, wallet: binding.wallet, enabled })
      .onConflictDoUpdate({
        target: creatorPayouts.xUserId,
        set: {
          wallet: binding.wallet,
          enabled,
          version: sql`${creatorPayouts.version} + 1`,
          updatedAt: new Date(),
        },
      });
  }
  const [record] = await database.db
    .select()
    .from(creatorPayouts)
    .where(eq(creatorPayouts.xUserId, binding.xUserId));
  return {
    xUserId: binding.xUserId,
    handle: binding.handle,
    wallet: binding.wallet,
    enabled:
      record?.wallet.toLowerCase() === binding.wallet.toLowerCase() &&
      record.enabled,
    version: record?.version ?? null,
    updatedAt: record?.updatedAt.toISOString() ?? null,
    mainnetFeesEnabled: process.env.CREATOR_FEES_ENABLED === "true",
    bps: 50,
  };
}

/** The caller chooses a creator ID, never a recipient address. Resolve from the verified registry. */
export async function resolveCreatorFee(xUserId: string, buyer: Address) {
  if (process.env.CREATOR_FEES_ENABLED !== "true")
    throw new IdentityError("creator_fees_disabled", 409);
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const [row] = await database.db
    .select({
      xUserId: creators.xUserId,
      wallet: creatorPayouts.wallet,
      version: creatorPayouts.version,
    })
    .from(creatorPayouts)
    .innerJoin(
      creators,
      and(
        eq(creators.xUserId, creatorPayouts.xUserId),
        eq(creators.wallet, creatorPayouts.wallet),
      ),
    )
    .where(
      and(
        eq(creatorPayouts.xUserId, xUserId),
        eq(creatorPayouts.enabled, true),
      ),
    );
  if (!row) throw new IdentityError("creator_payout_unavailable", 409);
  if (row.wallet.toLowerCase() === buyer.toLowerCase())
    throw new IdentityError("self_referral_not_allowed", 409);
  return {
    xUserId: row.xUserId,
    wallet: getAddress(row.wallet),
    version: row.version,
    bps: 50 as const,
  };
}

export async function publicPayout(handle: string) {
  const database = getDatabase();
  if (!database) throw new IdentityError("database_unavailable", 503);
  const rows = await database.db
    .select({
      xUserId: creators.xUserId,
      handle: creators.handle,
      wallet: creatorPayouts.wallet,
      enabled: creatorPayouts.enabled,
    })
    .from(creators)
    .innerJoin(
      creatorPayouts,
      and(
        eq(creators.xUserId, creatorPayouts.xUserId),
        eq(creators.wallet, creatorPayouts.wallet),
      ),
    )
    .where(eq(creators.handle, handle))
    .limit(2);
  return {
    creator: rows.length === 1 && rows[0]?.enabled ? rows[0] : null,
    mainnetFeesEnabled: process.env.CREATOR_FEES_ENABLED === "true",
    bps: 50,
  };
}
