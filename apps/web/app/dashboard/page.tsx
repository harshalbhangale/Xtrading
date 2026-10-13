import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHeading } from "../../components/dashboard/ui";
import { Terminal } from "../../components/terminal";

export const metadata: Metadata = { title: "Terminal" };
export default function DashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Live feed"
        title="Terminal"
        description="Calls from the creators you follow, as they post. Follow or fade, check if a call was deleted, and trade it."
        action={
          <Link
            className="term-trade-cta"
            href="/dashboard/trade?market=MON&instrument=spot&chainId=143"
          >
            <Image src="/brand/monad.png" alt="" width={32} height={32} />
            <span>
              <strong>Trade on Monad</strong>
              <small>Kuru spot · mainnet</small>
            </span>
            <i aria-hidden="true">↗</i>
          </Link>
        }
      />
      <Terminal />
    </>
  );
}
