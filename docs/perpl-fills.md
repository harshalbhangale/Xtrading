# Perpl fills

Perpl orders our team placed through Xtrading, read back from Monad testnet (chain 10143). Each one was signed by the trader's own wallet, a Privy embedded wallet or MetaMask, against Perpl's exchange at [`0x1964…80cc`](https://testnet.monadvision.com/address/0x1964c32f0be608e7d29302aff5e61268e72080cc). Xtrading prepared the transactions and never held a key.

Fill prices come from the `TakerOrderFilled` event in each receipt, not from the order request. Raw data with block numbers and hashes: [`perpl-testnet-user-signed-2026-10-14.json`](../contracts/deployments/perpl-testnet-user-signed-2026-10-14.json).

## 12 filled orders

| #   | Wallet         | Order    | Size      | Leverage | Filled at (AUSD) | Block      | Tx                                                                                                                     |
| --- | -------------- | -------- | --------- | -------- | ---------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1   | MetaMask       | ETH long | 1 ETH     | 2×       | 2,507.89         | 70,719,444 | [`0x6b0a…5e0e`](https://testnet.monadvision.com/tx/0x6b0a2f44404c033abe235d889933d9d669ef9bec6b0f59a4284dba6943a45e0e) |
| 2   | MetaMask       | ETH long | 0.1 ETH   | 2×       | 2,496.74         | 70,817,863 | [`0xd54a…260e`](https://testnet.monadvision.com/tx/0xd54a4d264b03bf4ef27585fe94b74eb89d18845dec208c40a8c52e15d4db260e) |
| 3   | MetaMask       | ETH long | 0.1 ETH   | 2×       | 2,496.53         | 70,817,985 | [`0x30a7…2b82`](https://testnet.monadvision.com/tx/0x30a73339f020817ad87b4b33f5a86175cc604492a6d149440b6b57a72f392b82) |
| 4   | MetaMask       | ETH long | 0.01 ETH  | 2×       | 2,506.43         | 70,820,363 | [`0x0085…bc6a`](https://testnet.monadvision.com/tx/0x008516383f834b6a2ddbc9fa0469ee2bc0d53eb745f0ef3f87d1b67ba549bc6a) |
| 5   | MetaMask       | ETH long | 0.001 ETH | 2×       | 2,513.71         | 70,825,101 | [`0x226c…ef51`](https://testnet.monadvision.com/tx/0x226c05ad6ac57d979eb6ddf47ff7f167fa65ff0b276ef4ccf594c965f395ef51) |
| 6   | MetaMask       | ETH long | 1 ETH     | 2×       | 2,517.28         | 70,826,242 | [`0x3fbc…1ee1`](https://testnet.monadvision.com/tx/0x3fbcb805aac2baf5d9706a18a144a2a55c60746d7d661d390e88a01648ef1ee1) |
| 7   | MetaMask       | ETH long | 0.001 ETH | 2×       | 2,502.44         | 70,830,658 | [`0xda1b…2507`](https://testnet.monadvision.com/tx/0xda1bbfa793ec13c349db8c725985c21411f07be3670f3c0821fe33691d792507) |
| 8   | Privy embedded | ETH long | 0.05 ETH  | 3×       | 2,503.67         | 70,847,776 | [`0x540d…f68f`](https://testnet.monadvision.com/tx/0x540dc253e038424bf036856b97761a19ad34fed20bd87fe83059b41a0a70f68f) |
| 9   | Privy embedded | ETH long | 0.05 ETH  | 3×       | 2,505.28         | 70,850,113 | [`0x8b30…21b8`](https://testnet.monadvision.com/tx/0x8b303d2c7f7278b4967c163b618034a11f39286c62decc7b699bacc5990e21b8) |
| 10  | MetaMask       | ETH long | 0.001 ETH | 2×       | 2,507.45         | 70,851,941 | [`0x7019…1223`](https://testnet.monadvision.com/tx/0x7019d135cf6ca55648223207e9c4ad933a127baee2be03e4452d4eca50051223) |
| 11  | MetaMask       | ETH long | 0.05 ETH  | 3×       | 2,512.89         | 70,858,457 | [`0x47e5…ad9c`](https://testnet.monadvision.com/tx/0x47e5f0db2c13ca9c2e46d68fc12272e7a8f56382eb5165864bba51fcb582ad9c) |
| 12  | MetaMask       | ETH long | 0.05 ETH  | 3×       | 2,511.79         | 70,859,147 | [`0x0d6d…fff4`](https://testnet.monadvision.com/tx/0x0d6d0a23398e8e279bb2f3aaf6ef1624b1126f3c6bf3863692881add5c4bfff4) |

## Account setup

Before the first order, each wallet approved an exact AUSD amount (never unlimited) and funded its own Perpl account.

| Wallet         | Step                         | Block      | Tx                                                                                                                     |
| -------------- | ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| MetaMask       | Approve exact AUSD amount    | 70,719,404 | [`0x9e53…e60d`](https://testnet.monadvision.com/tx/0x9e53fba0d8afe80eac92ed3e75e679a24909598debc74b58a3ece3ab05b2e60d) |
| MetaMask       | Open Perpl account with AUSD | 70,719,419 | [`0xe40f…322e`](https://testnet.monadvision.com/tx/0xe40faa01eb0cd234c4393d0ffdfcc6b42c37ee2b4e8ebb072e55fce2f85a322e) |
| MetaMask       | Approve exact AUSD amount    | 70,826,196 | [`0xb226…fbfd`](https://testnet.monadvision.com/tx/0xb22635d8b8a94be1e1d1079537daa253286c11f2c80be907284500578cbdfbfd) |
| MetaMask       | Deposit AUSD collateral      | 70,826,219 | [`0xbb59…30ef`](https://testnet.monadvision.com/tx/0xbb590fc88a477a7a34f74a36b21f315b8e62b90b72883192f767add2842e30ef) |
| Privy embedded | Approve exact AUSD amount    | 70,847,747 | [`0xae01…3128`](https://testnet.monadvision.com/tx/0xae01708bcf54dae1bff77999555bb64e0417182cdab4b3e6b4896e8a6e943128) |
| Privy embedded | Open Perpl account with AUSD | 70,847,760 | [`0x6891…bb77`](https://testnet.monadvision.com/tx/0x68918364d2fa53f6e2b21fb65bfe7cdaf1d78c2994079961e267397fc05cbb77) |
| Privy embedded | Approve exact AUSD amount    | 70,850,078 | [`0x1523…2808`](https://testnet.monadvision.com/tx/0x1523108b86a2c167f7de3551d8b9c1ef1afb08a69624fb0d3ec8c1c460d52808) |
| Privy embedded | Deposit AUSD collateral      | 70,850,094 | [`0x5eaf…e2d6`](https://testnet.monadvision.com/tx/0x5eafb2b678e781a1a1ec95d71742c4081adfc399f0c3e7652833e9ed795be2d6) |

How closing and withdrawing work: [Perpl exits](perpl-exits.md).
