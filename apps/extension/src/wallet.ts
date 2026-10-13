/** Content-script side of the wallet bridge: one pending request per id. */
export class WalletError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

export function walletRequest<T>(
  method: string,
  params: unknown[] = [],
  timeoutMs = 120000,
): Promise<T> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new WalletError("Wallet did not respond.", -2));
    }, timeoutMs);
    function onMessage(event: MessageEvent) {
      const data = event.data as {
        type?: string;
        id?: string;
        result?: T;
        error?: { code: number; message: string };
      };
      if (
        event.source !== window ||
        data?.type !== "xtrading-wallet-response" ||
        data.id !== id
      )
        return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      if (data.error)
        reject(new WalletError(data.error.message, data.error.code));
      else resolve(data.result as T);
    }
    window.addEventListener("message", onMessage);
    window.postMessage(
      { type: "xtrading-wallet-request", id, method, params },
      location.origin,
    );
  });
}

/** True when a browser wallet (MetaMask, Rabby…) is injected into X. */
export function hasBrowserWallet() {
  return walletRequest<boolean>("xtrading_ping", [], 1500).catch(() => false);
}
