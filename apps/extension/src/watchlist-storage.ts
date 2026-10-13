import {
  type WatchlistCommand,
  type WatchlistEntry,
  watchlistLimit,
  watchlistSchema,
} from "@call-my-bluff/domain";

const key = "tradepost.watchlist.v1";

export async function readWatchlist(): Promise<WatchlistEntry[]> {
  const stored = await chrome.storage.local.get(key);
  const parsed = watchlistSchema.safeParse(stored[key]);
  return parsed.success ? parsed.data.entries : [];
}

/** Callers serialize writes through the service worker queue. */
export async function updateWatchlist(
  command: Exclude<WatchlistCommand, { action: "read" }>,
): Promise<{ entries: WatchlistEntry[] } | { error: "watchlist_full" }> {
  const entries = await readWatchlist();
  let next: WatchlistEntry[];
  if (command.action === "remove") {
    next = entries.filter((entry) => entry.handle !== command.handle);
  } else if (entries.some((entry) => entry.handle === command.handle)) {
    next = entries;
  } else if (entries.length >= watchlistLimit) {
    return { error: "watchlist_full" };
  } else {
    next = [
      { handle: command.handle, savedAt: new Date().toISOString() },
      ...entries,
    ];
  }
  await chrome.storage.local.set({ [key]: { entries: next } });
  return { entries: next };
}
