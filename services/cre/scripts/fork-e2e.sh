#!/usr/bin/env bash
# End-to-end CRE settlement on a local anvil fork of Monad testnet:
# deploy CallSettlement (mock forwarder) -> fund rewards -> register a 1h call ->
# warp past expiry -> `cre workflow simulate --broadcast` -> verify CallSettled -> claim.
#
# The fork starts ~3h behind head so real Binance 1m candles exist for both the
# window start and expiry. Uses anvil's public dev account #0; no real keys involved.
#
# Usage: services/cre/scripts/fork-e2e.sh [ASSET=ETH] [DIRECTION=0(Up)|1(Down)] [TARGET_BPS=1]
set -euo pipefail

ASSET=${1:-ETH}
DIRECTION=${2:-0}
TARGET_BPS=${3:-1}
UPSTREAM=${MONAD_TESTNET_RPC_URL:-https://testnet-rpc.monad.xyz}
PORT=8548
RPC=http://127.0.0.1:$PORT
DEV_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
DEV=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
TOKEN=0x78928c53A623585317f9102B88C2d76Df66b6825
MOCK_FORWARDER=0xB9F79d863261869B234c481D1f9A7af84AeAd192

ROOT=$(cd "$(dirname "$0")/../../.." && pwd)
CRE=$ROOT/services/cre
WORK=$(mktemp -d)
trap 'kill ${ANVIL_PID:-} 2>/dev/null || true; rm -rf "$WORK"' EXIT

HEAD=$(cast block-number --rpc-url "$UPSTREAM")
FORK_BLOCK=$((HEAD - 30000))
echo "Forking Monad testnet at $FORK_BLOCK (head $HEAD)"
anvil --fork-url "$UPSTREAM" --fork-block-number "$FORK_BLOCK" --port $PORT --silent &
ANVIL_PID=$!
until cast chain-id --rpc-url $RPC >/dev/null 2>&1; do sleep 1; done

bytes32() { cast format-bytes32-string "$1"; }
ASSETS="[$(bytes32 BTC),$(bytes32 ETH),$(bytes32 SOL)]"
cd "$ROOT/contracts"
SETTLEMENT=$(forge create src/CallSettlement.sol:CallSettlement --rpc-url $RPC --private-key $DEV_KEY \
  --broadcast --constructor-args $TOKEN $MOCK_FORWARDER 10000000 1000000000 "$ASSETS" |
  awk '/Deployed to/ {print $3}')
echo "CallSettlement $SETTLEMENT"

send() { cast send "$@" --rpc-url $RPC --private-key $DEV_KEY >/dev/null; }
send $TOKEN "faucet()"
send $TOKEN "approve(address,uint256)" "$SETTLEMENT" 600000000
send "$SETTLEMENT" "fundRewards(uint256)" 500000000
CALL_ID=$(cast keccak "fork-e2e-$ASSET-$DIRECTION-$(date +%s)")
send "$SETTLEMENT" "registerCall(bytes32,bytes32,uint8,uint16,uint64,uint128,uint128,bytes32)" \
  "$CALL_ID" "$(bytes32 "$ASSET")" "$DIRECTION" "$TARGET_BPS" 3600 100000000 50000000 "$(cast keccak fork-e2e)"
echo "Registered $CALL_ID ($ASSET, direction $DIRECTION, ${TARGET_BPS}bps, 1h, bond 100 reward 50)"

# Past expiry + settlement delay; anvil's finalized tag trails latest by 64 blocks.
cast rpc evm_increaseTime 3700 --rpc-url $RPC >/dev/null
cast rpc anvil_mine 70 --rpc-url $RPC >/dev/null

jq --arg a "$SETTLEMENT" '.settlementAddress = $a' "$CRE/settlement/config.staging.json" \
  >"$CRE/settlement/config.local-fork.json"
(umask 077 && printf 'CRE_ETH_PRIVATE_KEY=%s\n' "${DEV_KEY#0x}" >"$WORK/anvil.env")
cd "$CRE"
cre workflow simulate settlement --target local-fork-settings --non-interactive \
  --trigger-index 0 --broadcast -e "$WORK/anvil.env" | grep -E "USER LOG|Result|✗|\"Settled"

STATUS=$(cast call "$SETTLEMENT" "getCall(bytes32)((address,bytes32,uint8,uint16,uint64,uint64,uint128,uint128,uint8,bytes32,uint256,uint256))" \
  "$CALL_ID" --rpc-url $RPC | tr -d '()' | awk -F', ' '{print $9}')
echo "Outcome status: $STATUS (2 Success, 3 Failure, 4 Tie, 1 still open)"
CLAIMABLE=$(cast call "$SETTLEMENT" "claimable(address)(uint256)" $DEV --rpc-url $RPC | awk '{print $1}')
echo "Claimable: $CLAIMABLE mUSDC units"
if [ "$CLAIMABLE" != "0" ]; then send "$SETTLEMENT" "claim()" && echo "Claimed"; fi
