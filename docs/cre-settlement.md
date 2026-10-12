# Hourly call settlement

Status: the CallSettlement contract and the hourly workflow are implemented. `services/cre/scripts/fork-e2e.sh` has run the success and slash paths on a local Monad fork. Testnet receiver `0x260264E74028d498a1A10f90dDC4f4b91F3395DF` still trusts the simulation forwarder. DON deployment and `setForwarder` to the production forwarder are pending. Envio indexes CallSettlement events from the `envio` branch; an indexed event is not a live hourly DON run.

Every hour, CRE discovers expired unsettled calls, fetches the historical price at each call's expiry, evaluates its registered terms and submits an authenticated onchain settlement report. Envio projects confirmed events into the dashboard and extension.

## Registration

The creator explicitly approves a call's bond. Store call ID, source-post hash, creator wallet, asset chain/address, direction, entry observation, expiry, price-source ID, methodology version, bond, reward and refund deadline. Commit terms onchain before the evaluation window starts; an ordinary retrospective X call can be scored but cannot acquire a retroactive financial penalty.

Reserve rewards from a funded pool and lock bonds per call. Use integer prices with explicit decimals and bigint token amounts. Keep the existing refundable CreatorStake contract separate.

## Hourly run

1. Use the scheduled UTC slot as the processing cutoff; catch up all older unresolved calls rather than only the last hour.
2. Read bounded pages of eligible calls and compare their database terms with the onchain commitment.
3. Fetch an approved historical price observation near expiry under a fixed tolerance. Never substitute the current price. Record source, observation timestamp and evidence hash.
4. Evaluate the immutable target/direction rule. Missing, conflicting or unsupported prices remain unresolved and eligible for retry.
5. Generate a CRE report containing the call ID, terms hash, expiry observation and evaluation result, chain/receiver domain and scheduled slot.
6. Deliver through the configured CRE forwarder. The receiver checks forwarder and workflow identity, expiry, report freshness and whether the call is already settled. Compute payouts from registered terms, never caller-supplied reward amounts.
7. Record submitted transaction separately from confirmed settlement. Retry safely using per-call idempotency; Envio reconciles actual events and reorgs.

## Financial outcomes

- Success: return the call bond and make the reserved reward claimable.
- Failure: deduct the pre-agreed call bond and release the unused reward reservation.
- Tie: proposed default is bond return with no reward.
- Price unavailable beyond the registered refund deadline: allow bond refund and release reward reservation without a performance verdict.

Implemented rules, from the contract and README: success returns the bond plus the reserved reward, failure moves the bond into the reward pool, a tie returns the bond, and a missing price never slashes (the bond is refundable after three days). The hackathon scope uses mUSDC on Monad testnet only. No unrestricted access to creator wallets is required; users claim payouts explicitly. Production activation still needs the DON deploy and the production forwarder.

## Delivery checks

Verify CRE support, chain selector and forwarder for Monad testnet 10143, CLI access and deployment permissions before promising live hourly execution. Demonstrate a real CRE simulation first; label simulation and manual test receiver calls accurately.

Foundry tests must cover locked collateral, reward reservation, unauthorized and replayed reports, premature settlement, duplicate payouts, ties, source validation, refunds and conservation of token balances. Workflow tests must cover historical price gaps, pagination, restart/catch-up and per-call retry isolation.

Official references: [CRE overview](https://docs.chain.link/cre/getting-started/overview), [consumer contracts](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts), [supported networks](https://docs.chain.link/cre/supported-networks).
