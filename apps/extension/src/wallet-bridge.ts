/**
 * Runs in X's page (main world), where MetaMask/Rabby inject window.ethereum.
 * Relays a fixed set of EIP-1193 calls from the Xtrading content script. Every
 * signature still needs the user's confirmation in their wallet; this bridge
 * adds no capability the page does not already have.
 */
type Ethereum = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};
const allowed = new Set([
  "eth_requestAccounts",
  "eth_accounts",
  "eth_chainId",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "eth_call",
  "eth_getBalance",
  "eth_sendTransaction",
  "eth_getTransactionReceipt",
]);
window.addEventListener("message", async (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data as {
    type?: string;
    id?: string;
    method?: string;
    params?: unknown[];
  };
  if (data?.type !== "xtrading-wallet-request" || typeof data.id !== "string")
    return;
  const ethereum = (window as unknown as { ethereum?: Ethereum }).ethereum;
  const respond = (body: Record<string, unknown>) =>
    window.postMessage(
      { type: "xtrading-wallet-response", id: data.id, ...body },
      location.origin,
    );
  if (data.method === "xtrading_ping")
    return respond({ result: Boolean(ethereum) });
  if (!ethereum)
    return respond({
      error: { code: 4900, message: "No browser wallet found." },
    });
  if (!data.method || !allowed.has(data.method))
    return respond({ error: { code: 4200, message: "Method not allowed." } });
  try {
    const result = await ethereum.request({
      method: data.method,
      params: data.params ?? [],
    });
    respond({ result: JSON.parse(JSON.stringify(result ?? null)) });
  } catch (error) {
    const e = error as { code?: number; message?: string };
    respond({
      error: { code: e.code ?? -1, message: e.message ?? "Wallet error" },
    });
  }
});
