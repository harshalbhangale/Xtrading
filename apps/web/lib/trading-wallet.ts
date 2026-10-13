import "server-only";
import {
  IdentityError,
  type identityService,
} from "@call-my-bluff/database/identity";
import { getAddress } from "viem";

type Linked = { privyUserId: string; wallets: string[] };

/**
 * The wallet a trading request acts for. Trading needs a Privy login, not an X
 * binding: the wallet must be linked to the signed-in Privy user (checked here
 * against Privy's own list), and the user's own wallet still signs every order.
 * Order: the wallet the browser says it is signing with, else an existing
 * binding, else the user's only wallet. Creators' payouts, registered calls and
 * identity keep using the X binding.
 */
export async function tradingWallet(
  request: Request,
  user: Linked,
  service: ReturnType<typeof identityService>,
) {
  const owned = user.wallets.map((w) => w.toLowerCase());
  const requested = request.headers.get("x-trading-wallet")?.toLowerCase();
  if (requested) {
    if (!/^0x[0-9a-f]{40}$/.test(requested) || !owned.includes(requested))
      throw new IdentityError("wallet_not_linked", 403);
    return getAddress(requested);
  }
  const binding = await service.current(user.privyUserId);
  if (binding && owned.includes(binding.wallet.toLowerCase()))
    return getAddress(binding.wallet);
  if (owned.length === 1 && owned[0]) return getAddress(owned[0]);
  throw new IdentityError(
    owned.length ? "wallet_choice_required" : "wallet_required",
    409,
  );
}
