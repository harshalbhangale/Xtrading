import {
  type BrowserFollowing,
  browserFollowingSchema,
  normalizeHandle,
} from "@call-my-bluff/domain";

const key = (viewer: string) => `tradepost.viewed-follows.v1:${viewer}`;
export async function readFollowing(viewer: string): Promise<BrowserFollowing> {
  if (normalizeHandle(viewer) !== viewer) throw new Error("Invalid viewer");
  const stored = await chrome.storage.local.get(key(viewer));
  const parsed = browserFollowingSchema.safeParse(stored[key(viewer)]);
  return parsed.success && parsed.data.viewerHandle === viewer
    ? parsed.data
    : {
        viewerHandle: viewer,
        enabled: false,
        follows: [],
        coverage: "viewed-only",
      };
}
// Serialize writes from concurrent DOM scans and settings updates through the worker.
export async function updateFollowing(
  viewer: string,
  update:
    | { enabled: boolean }
    | { observations: Array<{ handle: string; following: boolean }> },
) {
  const value = await readFollowing(viewer);
  if ("enabled" in update) {
    value.enabled = update.enabled;
    if (!value.enabled) value.follows = [];
  } else if (!value.enabled) return value;
  else {
    const entries = new Map(
      value.follows.map((entry) => [entry.handle, entry]),
    );
    for (const observation of update.observations) {
      if (
        normalizeHandle(observation.handle) !== observation.handle ||
        observation.handle === viewer
      )
        continue;
      if (observation.following)
        entries.set(observation.handle, {
          handle: observation.handle,
          observedAt: new Date().toISOString(),
        });
      else entries.delete(observation.handle);
    }
    value.follows = [...entries.values()]
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, 500);
  }
  await chrome.storage.local.set({ [key(viewer)]: value });
  return value;
}
