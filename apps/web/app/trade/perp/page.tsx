import Link from "next/link";
import { PerpTradeControl } from "../../../components/perp-trade-control";

/** Small window opened from X: the Privy wallet signs the perp order here. */
export default async function PerpWalletReview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Testnet unless the X ticket asked for mainnet; mainnet needs the server switch.
  const mainnet = (await searchParams).chainId === "143";
  const enabled = process.env.PERPL_MAINNET_ENABLED === "true";
  return (
    <div className="inline-wallet-review">
      <header>
        <Link href="/">Xtrading</Link>
        <h1>Sign perp order</h1>
      </header>
      <p>
        {mainnet
          ? "Perpl · Monad mainnet · real AUSD"
          : "Perpl · Monad testnet · test AUSD"}
      </p>
      {mainnet && !enabled ? (
        <p>
          Perpl mainnet is switched off on this server. Nothing falls back to
          testnet.
        </p>
      ) : (
        <PerpTradeControl chainId={mainnet ? 143 : 10143} />
      )}
      <p className="small-note">
        Your X timeline stays open. Your Xtrading wallet signs here and trades
        your own Perpl account.
      </p>
    </div>
  );
}
