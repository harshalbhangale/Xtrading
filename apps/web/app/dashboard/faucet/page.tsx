import type { Metadata } from "next";
import { AusdFaucetControl } from "../../../components/ausd-faucet-control";
import { PageHeading, Panel } from "../../../components/dashboard/ui";
export const metadata: Metadata = { title: "Test AUSD faucet" };
export default function FaucetPage() {
  return (
    <>
      <PageHeading
        title="Perpl test AUSD"
        description="Testnet collateral for perpetual trading. This token cannot fund our Kuru USDC markets."
      />
      <Panel
        title="Claim to your wallet"
        description="Every claim requires your wallet confirmation. No mainnet transactions are available here."
      >
        <AusdFaucetControl />
      </Panel>
    </>
  );
}
