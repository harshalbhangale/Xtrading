import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "../../components/brand";
import { FlowBackground } from "../../components/flow-background";
import { RoleChooser } from "../../components/role-chooser";

export const metadata: Metadata = { title: "Get started" };

export default function StartPage() {
  const testnet = process.env.NEXT_PUBLIC_MONAD_CHAIN_ID !== "143";
  return (
    <div className="start-page">
      <FlowBackground />
      <header className="start-top">
        <Link href="/" aria-label="Xtrading home">
          <Brand />
        </Link>
        <Link href="/">← Back to site</Link>
      </header>
      <section className="start-main" aria-labelledby="start-title">
        <p className="start-kicker">
          <i aria-hidden="true" />
          Get started
        </p>
        <h1 id="start-title">How will you use Xtrading?</h1>
        <p className="start-lede">
          Pick a workspace to sign in to. You can switch between them at any
          time from the sidebar.
        </p>
        <RoleChooser />
        <p className="start-foot">
          {testnet
            ? "Monad testnet (10143). Test tokens have no monetary value. "
            : "Monad mainnet. "}
          Every transaction is shown to you first and approved in your own
          wallet. Nothing signs on your behalf.
        </p>
      </section>
    </div>
  );
}
