import { z } from "zod";

/** Fixed allowlist: callers can never reach an arbitrary Nansen path. */
export type NansenPath =
  | "/api/v1/tgm/holders"
  | "/api/v1/tgm/who-bought-sold"
  | "/api/v1/tgm/flow-intelligence"
  | "/api/v1/tgm/pnl-leaderboard"
  | "/api/v1/tgm/token-information"
  | "/api/v1/profiler/dex-trades"
  | "/api/v1/profiler/perp-trades"
  | "/api/v1/profiler/address/related-wallets"
  | "/api/v1/profiler/address/pnl-summary"
  | "/api/v1/profiler/address/transactions";

/** Import only on the server. No caller-controlled URLs; no keys returned in errors. */
export function createNansenClient(
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey.trim()) throw new Error("Nansen API key is not configured");
  return {
    async post(path: NansenPath, body: Record<string, unknown>) {
      const response = await fetcher(`https://api.nansen.ai${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(`Nansen request failed (${response.status})`);
      const credits = response.headers.get("x-nansen-credits-used");
      return {
        source: "nansen" as const,
        fetchedAt: new Date().toISOString(),
        creditsUsed:
          credits && /^[0-9]{1,6}$/.test(credits) ? Number(credits) : null,
        data: z.unknown().parse(await response.json()),
      };
    },
  };
}
