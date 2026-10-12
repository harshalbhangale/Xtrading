import type { User } from "@privy-io/react-auth";

export const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

// What the signed-in account is shown as. This is the Privy session only;
// a verified X/wallet binding is checked separately on the server.
export function accountLabel(user: User) {
  const handle = user.twitter?.username;
  const wallet = user.wallet?.address;
  const name = handle
    ? `@${handle}`
    : (user.email?.address ?? (wallet ? shortAddress(wallet) : "Signed in"));
  return {
    name,
    initial: (handle ?? user.email?.address ?? "x").charAt(0).toUpperCase(),
    detail: wallet ? shortAddress(wallet) : "No wallet connected",
    handle: handle ?? null,
    wallet: wallet ?? null,
  };
}
