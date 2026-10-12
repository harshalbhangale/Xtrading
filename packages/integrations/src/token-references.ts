import type { PostSignal } from "@call-my-bluff/domain";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function solanaAddress(value: string) {
  let n = 0n;
  for (const char of value) n = n * 58n + BigInt(alphabet.indexOf(char));
  let bytes = 0;
  for (; n > 0n; n >>= 8n) bytes++;
  const leading = value.match(/^1*/)?.[0].length ?? 0;
  return leading + bytes === 32;
}
/** Address-shaped references only; neither token identity nor chain ownership is verified. */
export function tokenReferences(text: string): PostSignal["tokenReferences"] {
  const refs: PostSignal["tokenReferences"] = [];
  for (const match of text.matchAll(
    /(?<![A-Za-z0-9])(?:0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})(?![A-Za-z0-9])/g,
  )) {
    const value = match[0];
    const evm = value.startsWith("0x");
    if (!evm && !solanaAddress(value)) continue;
    const address = evm ? value.toLowerCase() : value;
    if (!refs.some((ref) => ref.address === address))
      refs.push({ address, kind: evm ? "evm" : "solana" });
    if (refs.length === 4) break;
  }
  return refs;
}
export function hasTokenMention(text: string) {
  return /\b(?:CA|contract(?: address)?|token address|mint)\b|\bpump\.fun\b|\b(?:buy|sell|bought|selling|entry|target)\b/i.test(
    text,
  );
}
