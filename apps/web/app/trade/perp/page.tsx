import Link from "next/link";
import { PerpTradeControl } from "../../../components/perp-trade-control";

/** Small window opened from X: the Privy wallet signs the perp order here. */
export default function PerpWalletReview() {
  return (
    <div className="inline-wallet-review">
      <header>
        <Link href="/">Xtrading</Link>
        <h1>Sign perp order</h1>
      </header>
      <p>Perpl · Monad testnet · test AUSD</p>
      <PerpTradeControl />
      <p className="small-note">
        Your X timeline stays open. Your Xtrading wallet signs here and trades
        your own Perpl account.
      </p>
    </div>
  );
}
