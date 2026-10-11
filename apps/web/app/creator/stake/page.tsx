import type { Metadata } from "next";
import Link from "next/link";
import {
  ConnectionNote,
  MetricCard,
  PageHeading,
  Panel,
  RecordTable,
} from "../../../components/dashboard/ui";

export const metadata: Metadata = { title: "Creator stake" };

export default function StakePage() {
  return (
    <>
      <PageHeading
        eyebrow="03 / Your stake"
        title="A commitment you can see."
        description="A refundable deposit signals participation. Your trade performance remains a separate record."
      />
      <div className="metric-grid">
        <MetricCard
          label="Locked balance"
          detail="Read from the deployed stake contract"
          icon="◇"
        />
        <MetricCard
          label="Stake eligibility"
          value="Unavailable"
          detail="Identity and onchain state required"
          icon="◎"
        />
        <MetricCard
          label="Withdrawal state"
          detail="No contract state connected"
        />
        <MetricCard
          label="Proposed cooldown"
          value="7 days"
          detail="Deployment parameters still need verification"
          icon="◷"
        />
      </div>
      <div className="dashboard-two-column">
        <Panel
          title="Deposit a stake"
          description="The initial product target is a nominal $500 in a selected stablecoin."
        >
          <div className="stake-form">
            <label htmlFor="stake-token">Stake token</label>
            <select id="stake-token" disabled>
              <option>Token not configured</option>
            </select>
            <label htmlFor="stake-amount">Deposit amount</label>
            <input
              id="stake-amount"
              placeholder="Enter token amount"
              disabled
            />
            <p>
              Token address, decimals and the deployed minimum must be checked
              before a transaction can be prepared.
            </p>
            <button className="button" type="button" disabled>
              Deposit unavailable
            </button>
            <Link className="text-link" href="/creator/profile">
              Start with identity linking ↗
            </Link>
          </div>
        </Panel>
        <Panel
          title="Withdrawal controls"
          description="You stay in control of your own deposit."
        >
          <div className="withdrawal-steps">
            <div>
              <span>01</span>
              <p>
                <strong>Request withdrawal</strong>Stake eligibility ends
                immediately when your request confirms.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Wait for the cooldown</strong>Your unlock time comes
                from the contract, not a local timer.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Withdraw or cancel</strong>After the cooldown, withdraw
                the full deposit. Cancelling restores stake eligibility if you
                meet the threshold.
              </p>
            </div>
          </div>
          <div className="button-row">
            <button className="button secondary-button" type="button" disabled>
              Request withdrawal
            </button>
            <button className="button secondary-button" type="button" disabled>
              Cancel request
            </button>
            <button className="button" type="button" disabled>
              Withdraw
            </button>
          </div>
        </Panel>
      </div>
      <Panel title="Stake receipts">
        <RecordTable
          columns={["Action", "Token amount", "Status", "Time", "Transaction"]}
          emptyTitle="Your stake history starts onchain."
          emptyDescription="Deposits and withdrawals will appear once the deployed contract is indexed."
        />
      </Panel>
      <ConnectionNote>
        There is no automatic slashing for a wrong financial call. Staking does
        not verify identity or imply profitability.
      </ConnectionNote>
    </>
  );
}
