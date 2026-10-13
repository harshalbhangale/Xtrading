import Link from "next/link";
import { TradeControl } from "../../../components/trade-control";
export default async function InlineWalletReview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const chainId =
    p.chainId === undefined || p.chainId === "10143"
      ? 10143
      : p.chainId === "143"
        ? 143
        : null;
  return (
    <div className="inline-wallet-review">
      <header>
        <Link href="/">Xtrading</Link>
        <h1>Secure wallet review</h1>
      </header>
      <p>
        {chainId === 143
          ? "Monad mainnet · real funds"
          : "Monad testnet · test tokens"}
      </p>
      {chainId ? (
        <TradeControl chainId={chainId} />
      ) : (
        <p>Unsupported network. No transaction is available.</p>
      )}
      <p className="small-note">
        Your X timeline stays open. This window handles authentication and
        wallet confirmation.
      </p>
    </div>
  );
}
