#!/usr/bin/env bash
# Monad mainnet demo, run once: Kuru market buy, sell back, and a creator-fee
# buy through Kuru Flow that pays the creator wallet inside the same tx.
#
#   scripts/mainnet-demo.sh --fork   # rehearsal on a local anvil fork of mainnet (free)
#   scripts/mainnet-demo.sh --live   # real transactions, each step at most once
#
# Key handling: the key is read from MAINNET_DEMO_KEY in $KEY_FILE (default
# ~/.xtrading/mainnet-demo.env, chmod 600). It is never printed, logged or
# committed. --fork needs only the address (it impersonates it on the fork).
#
# Every live step re-reads chain state first, simulates with eth_call, sets a
# 1% minimum output, and is recorded in contracts/deployments/mainnet-demo.json;
# a recorded step is never sent again.
set -euo pipefail

MODE=${1:-}
[[ "$MODE" == "--fork" || "$MODE" == "--live" ]] || {
  echo "usage: $0 --fork|--live" >&2
  exit 2
}
KEY_FILE=${KEY_FILE:-$HOME/.xtrading/mainnet-demo.env}
UPSTREAM=${MONAD_MAINNET_RPC_URL:-https://rpc.monad.xyz}
USDC=0x754704Bc059F8C67012fEd69BC8A327a5aafb603
BOOK=0x065C9d28E428A0db40191a54d33d5b7c71a9C394 # MON/USDC: price precision 1e8, size precision 1e10
ENTRY=0xb3e6778480b2E488385E8205eA05E20060B813cb # Kuru Flow entrypoint
ROUTER=0x2f84FB8982073f39Ba47c7fcC29119aF074AbbcB
CREATOR=${CREATOR_WALLET:-0x51bDFC2a4D1C3B04A89f8CA928bd377B767Df424}
FEE_BPS=${CREATOR_FEE_BPS:-10} # creator tier rate: 10 verified, 50 Pro, 100 Max, 200 Ultra
BUY_USDC=${BUY_USDC:-1000000}  # 1 USDC (6 decimals) per buy
ROOT=$(cd "$(dirname "$0")/.." && pwd)
RECORD=$ROOT/contracts/deployments/mainnet-demo.json

die() { echo "✗ $*" >&2; exit 1; }
num() { awk '{print $1}'; } # strip cast's "[1e6]" annotations
lower() { tr '[:upper:]' '[:lower:]' <<<"$1"; }
# Wei-sized values overflow 64-bit shell arithmetic: use bc for every amount.
math() { BC_LINE_LENGTH=0 bc <<<"$1"; }
ge() { [[ "$(math "$1 >= $2")" == "1" ]]; }

PK=""
if [[ -f "$KEY_FILE" ]]; then
  [[ "$(stat -f %Lp "$KEY_FILE" 2>/dev/null || stat -c %a "$KEY_FILE")" == "600" ]] ||
    die "$KEY_FILE must be chmod 600"
  PK=$(grep -E '^MAINNET_DEMO_KEY=' "$KEY_FILE" | cut -d= -f2- | tr -d '"[:space:]')
  [[ "$PK" =~ ^(0x)?[0-9a-fA-F]{64}$ ]] || die "MAINNET_DEMO_KEY in $KEY_FILE is not a 32-byte hex key"
  [[ "$PK" == 0x* ]] || PK=0x$PK
  SENDER=$(cast wallet address "$PK")
elif [[ "$MODE" == "--fork" ]]; then
  SENDER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 # anvil dev account; rehearsal only
else
  die "no key file at $KEY_FILE"
fi
[[ "$(lower "$SENDER")" != "$(lower "$CREATOR")" ]] || die "buyer and creator are the same wallet (self-referral is blocked)"

if [[ "$MODE" == "--fork" ]]; then
  RPC=http://127.0.0.1:8550
  anvil --fork-url "$UPSTREAM" --port 8550 --auto-impersonate --silent &
  ANVIL=$!
  trap 'kill $ANVIL 2>/dev/null || true' EXIT
  until cast chain-id --rpc-url $RPC >/dev/null 2>&1; do sleep 1; done
  RECORD=${FORK_RECORD:-$(mktemp)}
  [[ -s "$RECORD" ]] || echo '{}' >"$RECORD"
  send() { cast send "$@" --rpc-url $RPC --unlocked --from "$SENDER" --json; }
else
  RPC=$UPSTREAM
  [[ -f "$RECORD" ]] || echo '{}' >"$RECORD"
  send() { cast send "$@" --rpc-url $RPC --private-key "$PK" --json; }
fi
call() { cast call "$@" --rpc-url $RPC --from "$SENDER" | num; }
done_step() { jq -e --arg s "$1" '.[$s].status == "success"' "$RECORD" >/dev/null; }
record() { # step, json of the receipt, extra json
  local tx block status
  tx=$(jq -r .transactionHash <<<"$2")
  block=$(jq -r .blockNumber <<<"$2")
  status=$(jq -r .status <<<"$2")
  [[ "$status" == "0x1" ]] || die "$1 reverted: $tx"
  local extra=${3:-}
  [[ -n "$extra" ]] || extra='{}'
  # A step that cannot be recorded must stop the run, never be retried blind.
  jq --arg s "$1" --arg tx "$tx" --arg b "$((block))" --argjson x "$extra" \
    '.[$s] = ({status: "success", transactionHash: $tx, blockNumber: $b} + $x)' \
    "$RECORD" >"$RECORD.tmp" || die "could not record $1 ($tx); stop and check $RECORD"
  mv "$RECORD.tmp" "$RECORD"
  echo "  ✓ $1 · tx $tx"
}
musdc() { call $USDC "balanceOf(address)(uint256)" "$1"; }
mon() { cast balance "$1" --rpc-url $RPC; }

echo "== Preflight ($MODE) · sender $SENDER · creator $CREATOR · fee ${FEE_BPS} bps"
[[ "$(cast chain-id --rpc-url $RPC)" == "143" ]] || die "not Monad mainnet"
read -r PP SP BASE BD QUOTE QD _ < <(cast call $BOOK \
  "getMarketParams()(uint32,uint96,address,uint256,address,uint256,uint32,uint96,uint96,uint256,uint256)" \
  --rpc-url $RPC | num | tr '\n' ' ') || true
[[ "$PP $SP $(lower "$BASE") $BD $(lower "$QUOTE") $QD" == "100000000 10000000000 0x0000000000000000000000000000000000000000 18 $(lower $USDC) 6" ]] ||
  die "MON/USDC market parameters changed"
[[ "$(cast call $ENTRY 'getRouter()(address)' --rpc-url $RPC)" == "$ROUTER" ]] || die "Kuru Flow router changed"
[[ "$FEE_BPS" =~ ^(10|50|100|200)$ ]] || die "fee must be a tier rate"

if [[ "$MODE" == "--fork" ]]; then
  # Rehearsal funding only: 5 MON for gas, then real USDC by selling 200 MON on the fork.
  if ! ge "$(mon "$SENDER")" 3000000000000000000; then
    cast rpc anvil_setBalance "$SENDER" 0x4563918244F40000 --rpc-url $RPC >/dev/null
    cast rpc anvil_setBalance "$SENDER" 0xD8D726B7177A800000 --rpc-url $RPC >/dev/null # 4000 MON
  fi
  if ! ge "$(musdc "$SENDER")" "2 * $BUY_USDC"; then
    send $BOOK "placeAndExecuteMarketSell(uint96,uint256,bool,bool)" 2000000000000 1 false false \
      --value 200ether >/dev/null
  fi
fi
GAS=$(cast gas-price --rpc-url $RPC)
MON0=$(mon "$SENDER") USDC0=$(musdc "$SENDER")
echo "  MON $(cast from-wei "$MON0") · USDC $(echo "scale=6; $USDC0/1000000" | bc) · gas $(cast from-wei "$GAS" gwei) gwei"
ge "$MON0" 300000000000000000 || die "need at least 0.3 MON for gas"
ge "$USDC0" "2 * $BUY_USDC" || die "need at least $(math "2 * $BUY_USDC") USDC units (two buys)"

echo "== 1. Kuru market buy: $BUY_USDC USDC units → MON"
if done_step buy; then echo "  · already done"; else
  if ! ge "$(call $USDC "allowance(address,address)(uint256)" "$SENDER" $BOOK)" "$BUY_USDC"; then
    record approve-book "$(send $USDC "approve(address,uint256)" $BOOK "$BUY_USDC")"
  fi
  SIZE=$(math "$BUY_USDC * $PP / 1000000")
  OUT=$(call $BOOK "placeAndExecuteMarketBuy(uint96,uint256,bool,bool)(uint256)" $SIZE 1 false false)
  ge "$OUT" 1 || die "no buy liquidity"
  record buy "$(send $BOOK "placeAndExecuteMarketBuy(uint96,uint256,bool,bool)" $SIZE "$(math "$OUT * 99 / 100")" false false)" \
    "{\"spendUsdc\":\"$BUY_USDC\",\"expectedMonWei\":\"$OUT\"}"
fi

echo "== 2. Kuru market sell: the bought MON back to USDC"
if done_step sell; then echo "  · already done"; else
  BOUGHT=$(jq -r '.buy.expectedMonWei' "$RECORD")
  SIZE=$(math "$BOUGHT / 100000000") # wei → size units (1e18 / 1e10)
  SPEND=$(math "$SIZE * 100000000")
  ge "$SIZE" 1 || die "nothing to sell"
  OUT=$(call $BOOK "placeAndExecuteMarketSell(uint96,uint256,bool,bool)(uint256)" $SIZE 1 false false --value "$SPEND")
  record sell "$(send $BOOK "placeAndExecuteMarketSell(uint96,uint256,bool,bool)" $SIZE "$(math "$OUT * 99 / 100")" false false --value "$SPEND")" \
    "{\"spendMonWei\":\"$SPEND\",\"expectedUsdc\":\"$OUT\"}"
fi

echo "== 3. Creator-fee buy via Kuru Flow: $BUY_USDC USDC units → MON, ${FEE_BPS} bps to $CREATOR"
if done_step creator-fee-buy; then echo "  · already done"; else
  if ! ge "$(call $USDC "allowance(address,address)(uint256)" "$SENDER" $ENTRY)" "$BUY_USDC"; then
    record approve-flow "$(send $USDC "approve(address,uint256)" $ENTRY "$BUY_USDC")"
  fi
  # One configured Kuru order book only (same program the app builds).
  PROGRAM=$(cast abi-encode --packed "f(uint8,address,uint8,uint16,uint8,address,uint8,uint32,uint256,uint8)" \
    2 $USDC 1 65535 3 $BOOK 1 "$PP" "$SP" 6)
  SIG="executeSwap((address,uint256,address,uint256),(address,uint256,address,uint256,bool),bytes)"
  FEES="(0x0000000000000000000000000000000000000000,0,$CREATOR,$FEE_BPS,false)"
  NET=$(call $ENTRY "$SIG(uint256)" "(0x0000000000000000000000000000000000000000,1,$USDC,$BUY_USDC)" "$FEES" "$PROGRAM")
  ge "$NET" 1 || die "no Flow route"
  BEFORE=$(mon "$CREATOR")
  RECEIPT=$(send $ENTRY "$SIG" "(0x0000000000000000000000000000000000000000,$(math "$NET * 99 / 100"),$USDC,$BUY_USDC)" "$FEES" "$PROGRAM")
  FEE=$(math "$(mon "$CREATOR") - $BEFORE")
  ge "$FEE" 1 || die "creator was not paid"
  record creator-fee-buy "$RECEIPT" "{\"spendUsdc\":\"$BUY_USDC\",\"feeBps\":$FEE_BPS,\"creator\":\"$CREATOR\",\"creatorPaidMonWei\":\"$FEE\"}"
  echo "  creator received $(cast from-wei $FEE) MON"
fi

MON1=$(mon "$SENDER") USDC1=$(musdc "$SENDER")
echo "== Summary"
echo "  MON change (gas paid, plus MON kept from the fee buy): $(cast from-wei "$(math "$MON1 - $MON0")" 2>/dev/null || math "($MON1 - $MON0) / 10^18")"
echo "  USDC change: $(echo "scale=6; ($USDC1 - $USDC0)/1000000" | bc)"
[[ "$MODE" == "--live" ]] && echo "  recorded in contracts/deployments/mainnet-demo.json" || echo "  fork rehearsal only; nothing was sent to mainnet"
