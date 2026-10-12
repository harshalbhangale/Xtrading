import "server-only";
import { postSignals } from "@call-my-bluff/database";
import {
  type DetectedPost,
  normalizeHandle,
  postSignalSchema,
} from "@call-my-bluff/domain";
import { deriveTradeRoute } from "@call-my-bluff/integrations/signals";
import { desc, eq } from "drizzle-orm";
import { getDatabase } from "./database";
import { perplSnapshot } from "./markets";

export async function detectedPosts(input: string) {
  const handle = normalizeHandle(input),
    database = getDatabase();
  if (!handle || !database) return null;
  const rows = await database.db
    .select({ signal: postSignals.signal })
    .from(postSignals)
    .where(eq(postSignals.handle, handle))
    .orderBy(desc(postSignals.classifiedAt))
    .limit(10);
  const markets = rows.length
    ? await perplSnapshot()
        .then((s) =>
          s.markets.map((m) => ({
            marketId: m.marketId,
            symbol: m.symbol,
            open: m.open,
          })),
        )
        .catch(() => [])
    : [];
  const results: DetectedPost[] = [];
  for (const row of rows) {
    const parsed = postSignalSchema.safeParse(row.signal);
    if (!parsed.success || parsed.data.handle !== handle) continue;
    results.push({
      signal: parsed.data,
      route: deriveTradeRoute(parsed.data, markets),
    });
  }
  return results;
}
