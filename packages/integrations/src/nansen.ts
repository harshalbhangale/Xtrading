import { z } from "zod";

/** Import only on the server. No caller-controlled URLs; no keys returned in errors. */
export function createNansenClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey.trim()) throw new Error("Nansen API key is not configured");
  return {
    async post(
      path:
        | "/api/v1/tgm/holders"
        | "/api/v1/profiler/dex-trades"
        | "/api/v1/profiler/address/transactions",
      body: Record<string, unknown>,
    ) {
      const response = await fetcher(`https://api.nansen.ai${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(`Nansen request failed (${response.status})`);
      return {
        source: "nansen" as const,
        fetchedAt: new Date().toISOString(),
        data: z.unknown().parse(await response.json()),
      };
    },
  };
}
