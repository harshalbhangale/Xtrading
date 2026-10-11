import "server-only";

const windows = new Map<string, { start: number; count: number }>();

/** Fixed-window, in-process limiter. Bounded memory; resets on restart. */
export function allow(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    if (windows.size >= 5000) windows.clear();
    windows.set(key, { start: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}

export function clientKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}
