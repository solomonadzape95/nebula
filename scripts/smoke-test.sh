#!/usr/bin/env bash
#
# End-to-end walkthrough of the whole product against live testnet contracts.
#
# Simulates one user's complete journey — deposit, watch capital get deployed into Blend, watch
# real borrower interest raise the share price, redeem for more XLM than went in — and prints the
# vault's view at every step.
#
# This is also the script to follow when recording the demo video.
#
# Usage:
#   ./scripts/smoke-test.sh                       # uses the shared nebula-tester account
#   USER_ID=alice ./scripts/smoke-test.sh         # a distinct account, for onboarding real users
#   DEPOSIT=500 ./scripts/smoke-test.sh           # deposit 500 XLM instead of the default 100
#   SKIP_REDEEM=1 ./scripts/smoke-test.sh         # deposit and leave the position open

set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-testnet}"
USER_ID="${USER_ID:-nebula-tester}"
KEEPER="${KEEPER:-nebula-keeper}"
DEPOSIT="${DEPOSIT:-100}"
DEPLOYMENT="deployments/${NETWORK}.json"

[ -f "$DEPLOYMENT" ] || { echo "No deployment at $DEPLOYMENT — run scripts/deploy.sh first" >&2; exit 1; }

field() { sed -n "s/.*\"$1\": \"\([^\"]*\)\".*/\1/p" "$DEPLOYMENT" | head -1; }
VAULT="$(field vault)"
SHARE="$(field shareToken)"
STRATEGY="$(sed -n 's/.*"address": "\(C[^"]*\)".*/\1/p' "$DEPLOYMENT" | head -1)"

bold() { printf '\n\033[1m%s\033[0m\n'   "$1"; }
step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
note() { printf '  \033[2m%s\033[0m\n'   "$1"; }

# Contract calls return JSON-quoted scalars; strip the quotes so the values can be used as numbers.
call() { stellar contract invoke --id "$1" --source "$2" --network "$NETWORK" -- "${@:3}" 2>/dev/null | tr -d '"'; }
read_vault() { call "$VAULT" "$USER_ID" "$@"; }

xlm() { awk -v v="${1:-0}" 'BEGIN { printf "%.7f", v / 10000000 }'; }

# ---------------------------------------------------------------- account

step "Preparing account \"$USER_ID\""
if stellar keys public-key "$USER_ID" >/dev/null 2>&1; then
  note "reusing existing key"
else
  stellar keys generate --network "$NETWORK" --fund "$USER_ID" >/dev/null 2>&1
  note "generated and funded a new account"
fi
USER_PK="$(stellar keys public-key "$USER_ID")"
note "$USER_PK"

# ---------------------------------------------------------------- before

bold "═══ VAULT BEFORE ═══"
BEFORE_PRICE="$(read_vault share_price)"
printf '  %-22s %s XLM\n'          "TVL"          "$(xlm "$(read_vault total_assets)")"
printf '  %-22s %s XLM per nXLM\n' "Share price"  "$(xlm "$BEFORE_PRICE")"
printf '  %-22s %s XLM\n'          "Idle reserve" "$(xlm "$(read_vault idle)")"
printf '  %-22s %s XLM\n'          "Your nXLM"    "$(xlm "$(call "$SHARE" "$USER_ID" balance --id "$USER_PK")")"

# ---------------------------------------------------------------- deposit

step "Depositing ${DEPOSIT} XLM"
DEPOSIT_STROOPS=$(( DEPOSIT * 10000000 ))
MINTED="$(call "$VAULT" "$USER_ID" deposit --from "$USER_PK" --amount "$DEPOSIT_STROOPS")"
note "minted $(xlm "$MINTED") nXLM"
note "your balance never changes again — the token gets worth more instead"

# ---------------------------------------------------------------- allocate

step "Keeper: allocating idle XLM into Blend"
stellar contract invoke --id "$VAULT" --source "$KEEPER" --network "$NETWORK" -- allocate >/dev/null 2>&1
note "reserve kept back for instant redemptions: $(xlm "$(read_vault idle)") XLM"
if [ -n "$STRATEGY" ]; then
  note "supplied to Blend: $(xlm "$(call "$STRATEGY" "$USER_ID" total_assets)") XLM"
  note "unrealized interest: $(xlm "$(call "$STRATEGY" "$USER_ID" pending_interest)") XLM"
fi

# ---------------------------------------------------------------- harvest

step "Keeper: harvesting real Blend interest"
NET="$(stellar contract invoke --id "$VAULT" --source "$KEEPER" --network "$NETWORK" -- harvest 2>/dev/null | tr -d '"')"
AFTER_PRICE="$(read_vault share_price)"
note "credited to share price: $(xlm "$NET") XLM (net of the 10% protocol fee)"
note "share price $(xlm "$BEFORE_PRICE") → $(xlm "$AFTER_PRICE")"
if [ "$AFTER_PRICE" -gt "$BEFORE_PRICE" ] 2>/dev/null; then
  printf '  \033[1;32m✓ the share price rose — every holder just earned, with no transaction\033[0m\n'
else
  note "no interest had accrued yet; leave the position open and re-run later"
fi

# ---------------------------------------------------------------- redeem

if [ -n "${SKIP_REDEEM:-}" ]; then
  bold "═══ POSITION LEFT OPEN ═══"
  printf '  %-22s %s nXLM\n' "Your nXLM" "$(xlm "$(call "$SHARE" "$USER_ID" balance --id "$USER_PK")")"
  printf '  %-22s %s XLM\n'  "Worth now" "$(xlm "$(read_vault preview_redeem --shares "$(call "$SHARE" "$USER_ID" balance --id "$USER_PK")")")"
  note "re-run with SKIP_REDEEM unset to cash out"
  exit 0
fi

step "Redeeming the full position"
SHARES="$(call "$SHARE" "$USER_ID" balance --id "$USER_PK")"
RETURNED="$(call "$VAULT" "$USER_ID" redeem --from "$USER_PK" --shares "$SHARES")"
note "returned $(xlm "$RETURNED") XLM"

# ---------------------------------------------------------------- after

bold "═══ VAULT AFTER ═══"
printf '  %-22s %s XLM\n'          "TVL"         "$(xlm "$(read_vault total_assets)")"
printf '  %-22s %s XLM per nXLM\n' "Share price" "$(xlm "$(read_vault share_price)")"

DELTA=$(( RETURNED - DEPOSIT_STROOPS ))
bold "═══ RESULT ═══"
printf '  deposited %s XLM, redeemed %s XLM\n' "$(xlm "$DEPOSIT_STROOPS")" "$(xlm "$RETURNED")"
if [ "$DELTA" -gt 0 ]; then
  printf '  \033[1;32m✓ net +%s XLM earned from Blend lending interest\033[0m\n' "$(xlm "$DELTA")"
else
  printf '  net %s XLM — too little time in the pool to out-earn share rounding\n' "$(xlm "$DELTA")"
  note "deposit for longer, or run with SKIP_REDEEM=1 and come back later"
fi

echo
note "Index these events:  cd indexer && npm run sync && npm run stats"
