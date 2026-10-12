"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const NETWORK_COOKIE = "xt_network";
type Network = "10143" | "143";

function readCookie(): Network {
  const match = document.cookie.match(/(?:^|;\s*)xt_network=(10143|143)\b/);
  return (match?.[1] as Network | undefined) ?? "10143";
}

/**
 * Explicit testnet/mainnet choice for trading, remembered per browser.
 * Testnet is the default; mainnet is never selected implicitly.
 */
export function NetworkSwitch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [network, setNetwork] = useState<Network>("10143");
  const fromUrl = params.get("chainId");
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-read after navigation.
  useEffect(() => {
    setNetwork(
      fromUrl === "143" || fromUrl === "10143" ? fromUrl : readCookie(),
    );
  }, [pathname, fromUrl]);
  function choose(next: Network) {
    // biome-ignore lint/suspicious/noDocumentCookie: Plain preference cookie read by the server page.
    document.cookie = `${NETWORK_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setNetwork(next);
    if (fromUrl) {
      const query = new URLSearchParams(params.toString());
      query.set("chainId", next);
      router.replace(`${pathname}?${query}`);
    } else router.refresh();
  }
  return (
    <fieldset
      className={`network-switch${compact ? " network-switch-compact" : ""}`}
      aria-label="Trading network"
    >
      {(
        [
          ["10143", "Testnet"],
          ["143", "Mainnet"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={network === id}
          data-network={id}
          onClick={() => choose(id)}
        >
          <i aria-hidden="true" />
          {label}
          {!compact && <span>{id === "143" ? "real funds" : "10143"}</span>}
        </button>
      ))}
    </fieldset>
  );
}
