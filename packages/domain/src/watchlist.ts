import { z } from "zod";

// Saved creator handles. A saved handle is a lookup hint, never a verified identity.
export const watchlistLimit = 50;

const handleSchema = z.string().regex(/^[a-z0-9_]{1,15}$/);

export const watchlistEntrySchema = z.object({
  handle: handleSchema,
  savedAt: z.iso.datetime(),
});
export type WatchlistEntry = z.infer<typeof watchlistEntrySchema>;

export const watchlistSchema = z.object({
  entries: z.array(watchlistEntrySchema).max(watchlistLimit),
});
export type Watchlist = z.infer<typeof watchlistSchema>;

export const watchlistCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read") }),
  z.object({ action: z.enum(["add", "remove"]), handle: handleSchema }),
]);
export type WatchlistCommand = z.infer<typeof watchlistCommandSchema>;
