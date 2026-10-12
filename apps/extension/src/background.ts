import {
  creatorOverviewSchema,
  normalizeHandle,
  postAvailabilitySchema,
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

// Perp-scoped extension session. Stored only here; content scripts get status, not the token.
const sessionKey = "xtrading.extension-session.v1";
type Session = { token: string; handle: string | null; expiresAt: string };
async function readSession(): Promise<Session | null> {
  const stored = (await chrome.storage.local.get(sessionKey))[sessionKey] as
    | Session
    | undefined;
  if (!stored || Date.parse(stored.expiresAt) <= Date.now()) return null;
  return stored;
}
/** Authenticated call to the app; returns the body or the error code, never throws. */
async function sessionCall(path: string, body?: unknown) {
  const session = await readSession();
  if (!session) return { failure: "not_connected" };
  try {
    const response = await fetch(`${appOrigin}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Extension ${session.token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
      credentials: "omit",
    });
    const value = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    if (response.status === 401) await chrome.storage.local.remove(sessionKey);
    if (!response.ok)
      return {
        failure: typeof value?.error === "string" ? value.error : "unavailable",
      };
    return { result: value };
  } catch {
    return { failure: "unavailable" };
  }
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
  if (
    message.type === "post-availability" &&
    typeof message.postId === "string" &&
    /^[0-9]{1,20}$/.test(message.postId)
  ) {
    const postId = message.postId;
    // The server rate-limits post checks; a short cache lets a deletion show up quickly.
    return cached(`availability:${postId}`, 120000, async () =>
      postAvailabilitySchema.parse(
        await getJson(`/api/posts/${postId}/availability`),
      ),
    );
  }
  if (message.type === "session-status")
    return readSession().then((session) => ({
      connected: Boolean(session),
      handle: session?.handle ?? null,
      expiresAt: session?.expiresAt ?? null,
    }));
  if (message.type === "session-clear")
    return chrome.storage.local
      .remove(sessionKey)
      .then(() => ({ cleared: true }));
  if (
    (message.type === "perp-prepare" || message.type === "perp-submit") &&
    message.order &&
    typeof message.order === "object"
  )
    return sessionCall(
      `/api/extension/perp/${message.type === "perp-prepare" ? "prepare" : "submit"}`,
      message.order,
    );
  if (
    message.type === "perp-status" &&
    typeof message.requestId === "number" &&
    Number.isSafeInteger(message.requestId)
  )
    return sessionCall(`/api/extension/perp/status?rq=${message.requestId}`);
  if (message.type === "markets")
    // Public market data only; a short cache keeps the ticket's mark price fresh.
    return cached("markets", 10000, () => getJson("/api/markets"));
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
  if (message.type === "store-session") {
    if (
      senderUrl.origin !== appOrigin ||
      senderUrl.pathname !== "/extension/connect" ||
      typeof message.token !== "string" ||
      !/^v1\.[A-Za-z0-9_-]{1,512}\.[A-Za-z0-9_-]{43}$/.test(message.token) ||
      typeof message.expiresAt !== "string" ||
      !(Date.parse(message.expiresAt) > Date.now())
    )
      return false;
    void chrome.storage.local
      .set({
        [sessionKey]: {
          token: message.token,
          handle:
            typeof message.handle === "string"
              ? normalizeHandle(message.handle)
              : null,
          expiresAt: message.expiresAt,
        },
      })
      .then(() => respond({ saved: true }))
      .catch(() => respond({ saved: false }));
    return true;
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
