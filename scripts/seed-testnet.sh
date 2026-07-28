#!/usr/bin/env bash
#
# Seed the testnet vault with realistic activity.
#
# Creates a set of funded accounts and has them deposit varied amounts, with allocate and harvest
# cycles interleaved and a couple of partial withdrawals. The result is a depositor table and an
# activity feed that look like a product in use rather than one round number repeated.
#
# Deliberately does NOT redeploy. A fresh deployment resets the share price to exactly 1.0 and
# throws away every harvest the vault has already earned, which makes the data less realistic, not
# more: a brand new vault with no history is precisely the thing this is trying to stop looking
# like. Amounts are uneven and the ordering is interleaved for the same reason.
#
# Usage:
#   ./scripts/seed-testnet.sh              # default set of depositors
#   COUNT=12 ./scripts/seed-testnet.sh     # more of them

set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-testnet}"
KEEPER="${KEEPER:-nebula-keeper}"
COUNT="${COUNT:-9}"
DEPLOYMENT="deployments/${NETWORK}.json"

[ -f "$DEPLOYMENT" ] || { echo "No deployment at $DEPLOYMENT" >&2; exit 1; }

field() { sed -n "s/.*\"$1\": \"\([^\"]*\)\".*/\1/p" "$DEPLOYMENT" | head -1; }
VAULT="$(field vault)"
SHARE="$(field shareToken)"

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
note() { printf '  \033[2m%s\033[0m\n' "$1"; }

call() { stellar contract invoke --id "$1" --source "$2" --network "$NETWORK" -- "${@:3}" 2>/dev/null | tr -d '"'; }
xlm() { awk -v v="${1:-0}" 'BEGIN { printf "%.4f", v / 10000000 }'; }

# Uneven, human-looking amounts. Nobody deposits exactly 100.00 nine times in a row.
AMOUNTS=(250 40 1750 85 620 15 430 95 1200 60 310 75)

keeper_run() {
  stellar contract invoke --id "$VAULT" --source "$KEEPER" --network "$NETWORK" -- allocate >/dev/null 2>&1 || true
  stellar contract invoke --id "$VAULT" --source "$KEEPER" --network "$NETWORK" -- harvest >/dev/null 2>&1 || true
}

step "Seeding $COUNT depositors into $VAULT"
note "share price before: $(xlm "$(call "$VAULT" "$KEEPER" share_price)")"

for i in $(seq 1 "$COUNT"); do
  id="nebula-tester-$i"
  amount="${AMOUNTS[$(( (i - 1) % ${#AMOUNTS[@]} ))]}"

  if ! stellar keys public-key "$id" >/dev/null 2>&1; then
    stellar keys generate --network "$NETWORK" --fund "$id" >/dev/null 2>&1
  fi
  pk="$(stellar keys public-key "$id")"

  printf '  %-18s %-6s XLM  ' "$id" "$amount"
  if stellar contract invoke --id "$VAULT" --source "$id" --network "$NETWORK" \
      -- deposit --from "$pk" --amount "$(( amount * 10000000 ))" >/dev/null 2>&1; then
    printf '\033[0;32mok\033[0m\n'
  else
    printf '\033[0;33mskipped\033[0m\n'
    continue
  fi

  # Keeper runs mid-way through rather than once at the end, so the share price moves *between*
  # deposits. That is what gives later depositors a different entry price from earlier ones, which
  # is the whole shape of the data worth demonstrating.
  if [ $(( i % 3 )) -eq 0 ]; then
    keeper_run
    note "  keeper ran; share price now $(xlm "$(call "$VAULT" "$KEEPER" share_price)")"
  fi
done

step "Partial withdrawals"
# A few people taking some out, so the activity feed is not a wall of deposits.
for i in 2 5; do
  id="nebula-tester-$i"
  stellar keys public-key "$id" >/dev/null 2>&1 || continue
  pk="$(stellar keys public-key "$id")"
  held="$(call "$SHARE" "$id" balance --id "$pk")"
  [ -z "$held" ] && continue
  half=$(( held / 3 ))
  [ "$half" -le 0 ] && continue

  printf '  %-18s redeeming %s nXLM  ' "$id" "$(xlm "$half")"
  if stellar contract invoke --id "$VAULT" --source "$id" --network "$NETWORK" \
      -- redeem --from "$pk" --shares "$half" >/dev/null 2>&1; then
    printf '\033[0;32mok\033[0m\n'
  else
    printf '\033[0;33mskipped\033[0m\n'
  fi
done

step "Final keeper pass"
keeper_run

step "Result"
printf '  %-16s %s XLM\n' "TVL" "$(xlm "$(call "$VAULT" "$KEEPER" total_assets)")"
printf '  %-16s %s\n'     "Share price" "$(xlm "$(call "$VAULT" "$KEEPER" share_price)")"
printf '  %-16s %s XLM\n' "Idle reserve" "$(xlm "$(call "$VAULT" "$KEEPER" idle)")"

echo
note "Index it:  cd indexer && npm run sync && npm run stats"
