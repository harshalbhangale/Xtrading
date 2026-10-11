import {
  normalizeHandle,
  publicCreatorEvidenceSchema,
} from "@call-my-bluff/domain";
import { appOrigin } from "./config";

const cache = new Map<string, { expires: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const waiting: Array<() => void> = [];
let active = 0;
async function load(handle: string) {
  if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    const response = await fetch(
      `${appOrigin}/api/creators/${encodeURIComponent(handle)}`,
      {
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
        credentials: "omit",
      },
    );
    if (!response.ok) throw new Error("unavailable");
    const value = publicCreatorEvidenceSchema.parse(await response.json());
    if (value.handle.toLowerCase() !== handle)
      throw new Error("mismatched_handle");
    if (cache.size >= 100) cache.clear();
    cache.set(handle, { expires: Date.now() + 15000, value });
    return value;
  } catch {
    return { error: "evidence_unavailable" };
  } finally {
    pending.delete(handle);
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (
    !sender.tab?.url ||
    !/^https:\/\/(x\.com|twitter\.com)\//.test(sender.tab.url) ||
    message?.type !== "creator-evidence" ||
    typeof message.handle !== "string"
  )
    return false;
  const handle = normalizeHandle(message.handle);
  if (!handle) {
    respond({ error: "invalid_handle" });
    return false;
  }
  const cached = cache.get(handle);
  if (cached && cached.expires > Date.now()) {
    respond(cached.value);
    return false;
  }
  let request = pending.get(handle);
  if (!request) {
    if (pending.size >= 100) {
      respond({ error: "evidence_unavailable" });
      return false;
    }
    request = load(handle);
    pending.set(handle, request);
  }
  void request.then(respond);
  return true;
});
