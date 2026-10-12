import "server-only";

// The hosted development plan allows 100 queries a minute. A short cache keeps
// bursts (creator pages, extension badges) under it; callers still compare the
// indexer's progress with the chain head, so a cached answer is never "current"
// for longer than that check allows.
const TTL_MS = 15_000;
const cache = new Map<string, { expires: number; body: unknown }>();

/** POSTs a fixed GraphQL query to the configured Envio endpoint; null when unavailable. */
export async function envioQuery(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: Record<string, unknown>; errors?: unknown } | null> {
  const endpoint = process.env.ENVIO_GRAPHQL_URL;
  if (!endpoint) return null;
  const key = JSON.stringify([query, variables]);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now())
    return hit.body as { data?: Record<string, unknown> };
  const response = await fetch(endpoint, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ENVIO_HASURA_ADMIN_SECRET
        ? { "X-Hasura-Admin-Secret": process.env.ENVIO_HASURA_ADMIN_SECRET }
        : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: unknown;
  };
  if (!body.errors) {
    if (cache.size >= 500) cache.clear();
    cache.set(key, { expires: Date.now() + TTL_MS, body });
  }
  return body;
}
