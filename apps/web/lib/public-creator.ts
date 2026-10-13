import "server-only";
import { creators } from "@call-my-bluff/database";
import {
  normalizeHandle,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import { desc, eq } from "drizzle-orm";
import { getDatabase } from "./database";

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
    // Compatibility for older extension builds; staking is retired, never a public signal.
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
  return result;
}
