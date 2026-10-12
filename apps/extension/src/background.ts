import {
  creatorOverviewSchema,
  normalizeHandle,
  postSignalRequestSchema,
  postSignalResponseSchema,
  publicCallLedgerSchema,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import { appOrigin } from "./config";
import { readFollowing, updateFollowing } from "./follow-storage";

type Entry = { expires: number; value: unknown };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const waiting: Array<() => void> = [];
let active = 0;

async function limited<T>(task: () => Promise<T>) {
  if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await task();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

/** Deduplicated, bounded fetch through the app API. No cookies or tokens are sent. */
function cached(
  key: string,
  ttl: number,
  load: () => Promise<unknown>,
): Promise<unknown> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 100) return Promise.resolve({ error: "busy" });
  const request = limited(load)
    .then((value) => {
      if (cache.size >= 500) cache.clear();
      cache.set(key, { expires: Date.now() + ttl, value });
      return value;
    })
    .catch(() => ({ error: "unavailable" }))
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

async function getJson(path: string, init?: RequestInit) {
  const response = await fetch(`${appOrigin}${path}`, {
    ...init,
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
    credentials: "omit",
  });
  if (!response.ok) throw new Error("unavailable");
  return (await response.json()) as unknown;
}

function handleMessage(
  message: Record<string, unknown>,
): Promise<unknown> | null {
  if (
    message.type === "creator-evidence" &&
    typeof message.handle === "string"
  ) {
    const handle = normalizeHandle(message.handle);
    if (!handle) return Promise.resolve({ error: "invalid_handle" });
    return cached(`evidence:${handle}`, 30000, async () => {
      const value = publicCreatorEvidenceSchema.parse(
        await getJson(`/api/creators/${encodeURIComponent(handle)}`),
      );
      if (value.handle.toLowerCase() !== handle)
        throw new Error("mismatched_handle");
      return value;
    });
  }
  if (
    message.type === "creator-overview" &&
    typeof message.handle === "string"
  ) {
    const handle = normalizeHandle(message.handle);
    if (!handle) return Promise.resolve({ error: "invalid_handle" });
    return cached(`overview:${handle}`, 30000, async () => {
      const value = creatorOverviewSchema.parse(
        await getJson(`/api/creators/${handle}/overview`),
      );
      if (value.handle !== handle) throw new Error("mismatched_handle");
      return value;
    });
  }
  if (message.type === "creator-ledger" && typeof message.handle === "string") {
    const handle = normalizeHandle(message.handle);
    if (!handle) return Promise.resolve({ error: "invalid_handle" });
    return cached(`ledger:${handle}`, 30000, async () => {
      const value = publicCallLedgerSchema.parse(
        await getJson(`/api/creators/${encodeURIComponent(handle)}/calls`),
      );
      if (value.handle !== handle) throw new Error("mismatched_handle");
      return value;
    });
  }
  if (message.type === "classify-post") {
    const input = postSignalRequestSchema.safeParse(message.payload);
    if (!input.success) return Promise.resolve({ error: "invalid_post" });
    return cached(`signal:${JSON.stringify(input.data)}`, 600000, async () =>
      postSignalResponseSchema.parse(
        await getJson("/api/signals/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.data),
        }),
      ),
    );
  }
  if (
    message.type === "creator-insights" &&
    typeof message.handle === "string"
  ) {
    const handle = normalizeHandle(message.handle);
    if (!handle) return Promise.resolve({ error: "invalid_handle" });
    const params = new URLSearchParams();
    if (
      typeof message.asset === "string" &&
      /^[A-Z0-9]{1,12}$/.test(message.asset)
    )
      params.set("asset", message.asset);
    if (message.direction === "bullish" || message.direction === "bearish")
      params.set("direction", message.direction);
    return cached(`insights:${handle}:${params}`, 30000, () =>
      getJson(`/api/creators/${encodeURIComponent(handle)}/insights?${params}`),
    );
  }
  return null;
}

let followWrites: Promise<unknown> = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!sender.tab?.url || typeof message !== "object" || message === null)
    return false;
  let senderUrl: URL;
  try {
    senderUrl = new URL(sender.tab.url);
  } catch {
    return false;
  }
  if (message.type === "app-following") {
    if (
      senderUrl.origin !== appOrigin ||
      senderUrl.pathname !== "/dashboard/watchlist" ||
      typeof message.viewer !== "string"
    )
      return false;
    const viewer = normalizeHandle(message.viewer);
    if (
      !viewer ||
      !["read", "configure"].includes(message.action) ||
      (message.action === "configure" && typeof message.enabled !== "boolean")
    )
      return false;
    followWrites = followWrites
      .catch(() => null)
      .then(() =>
        message.action === "read"
          ? readFollowing(viewer)
          : updateFollowing(viewer, { enabled: message.enabled }),
      );
    void followWrites
      .then(respond)
      .catch(() => respond({ error: "storage_unavailable" }));
    return true;
  }
  if (!/^https:\/\/(x\.com|twitter\.com)\//.test(sender.tab.url)) return false;
  if (message.type === "observe-following") {
    const viewer =
      typeof message.viewer === "string"
        ? normalizeHandle(message.viewer)
        : null;
    const observations = message.observations;
    if (
      !viewer ||
      !Array.isArray(observations) ||
      observations.length > 100 ||
      !observations.every(
        (item) =>
          item &&
          typeof item.handle === "string" &&
          typeof item.following === "boolean",
      )
    )
      return false;
    followWrites = followWrites
      .catch(() => null)
      .then(() => updateFollowing(viewer, { observations }));
    void followWrites
      .then(() => respond({ saved: true }))
      .catch(() => respond({ error: "storage_unavailable" }));
    return true;
  }
  const result = handleMessage(message as Record<string, unknown>);
  if (!result) return false;
  void result.then(respond);
  return true;
});
