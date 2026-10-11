# Verified identity binding

The creator profile connects a server-verified Privy/X session to a wallet using an explicit off-chain ownership signature. Identity does not imply an active stake, accurate calls or profitable wallet returns.

## Configuration and flow

Configure `NEXT_PUBLIC_PRIVY_APP_ID`, server-only `PRIVY_APP_SECRET`, `NEXT_PUBLIC_APP_URL` and the database connection. Enable Twitter login and automatic EVM embedded-wallet creation for users without wallets in Privy. Apply database migrations before starting the app. Remote database connections require verified TLS; use the AWS bootstrap for cloud migrations and restricted-role grants.

On `/creator/profile`, sign in, select a linked wallet, prepare an ownership proof, review the complete message and explicitly sign it. The message includes the configured origin, chain, stable X ID, Privy session owner, wallet, random nonce, issue time and five-minute expiry. It authorizes no transaction or token approval. There is no automatic signing.

## Implemented endpoints

All endpoints require `Authorization: Bearer <Privy access token>`. The server verifies the token and fetches authoritative linked accounts from Privy. POST requests require an exact `Origin` match to `NEXT_PUBLIC_APP_URL`, JSON content type and a body of at most 4096 bytes. Responses are runtime validated and use `Cache-Control: no-store`.

| Endpoint | Body | Result |
|---|---|---|
| `GET /api/identity` | None | Current X account, persisted binding or null, and `bindingCurrent` |
| `POST /api/identity/challenge` | `{ "wallet": "0x…" }` | Challenge ID, immutable signing message, wallet and expiry |
| `POST /api/identity/bind` | `{ "challengeId": "<UUID>", "signature": "0x…" }` | Persisted stable X ID, handle, wallet and link timestamp |

The API does not accept client-supplied identity IDs, chain IDs or signing messages. `bindingCurrent` requires the persisted identity, current handle and currently linked wallet to match the provider record. This is a private onboarding API; public creator/extension lookup is a later milestone.

## Persistence and failure behavior

`wallet_challenges` stores one current challenge per Privy account. Issuance is serialized, limited to one per ten seconds and thirty per hour, and invalidates the previous nonce. Binding locks the challenge, verifies its context and signature, and atomically consumes it while writing the creator binding. Replay and concurrent duplicate submissions cannot create additional bindings.

Existing bindings cannot silently move to another X account, session owner or wallet. Recovery and wallet migration need a separate future flow. Current signature verification supports EOA wallets, including Privy embedded EVM wallets; contract-wallet signature verification is not implemented.

Public error codes distinguish invalid sessions (401), rejected origins or wallet proofs (403), expired/used challenges, changed identity and conflicting bindings (409), issuance limits (429), and unavailable providers/database (503). Raw provider errors and secrets are not returned.

## Verification

Run local migrations, then `IDENTITY_TEST_DATABASE_URL=postgresql://cmb:cmb_local@localhost:5433/call_my_bluff pnpm check`. Integration tests refuse remote databases and clean up their synthetic fixtures. Tests cover valid persistence, replay, concurrent replay, wrong account/network, changed identity, forged signatures, expiry, unlinked wallets, conflicting bindings and nonce replacement.

The configured project's real X login and embedded-wallet creation succeeded. A real challenge was issued using the Mumbai database. The final real wallet signature and persistence-after-refresh check are awaiting user approval; local integration tests establish those code paths without claiming a completed live binding.

Official references: [Privy access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens), [Privy Node setup](https://docs.privy.io/basics/nodeJS/setup).
