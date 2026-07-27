#!/usr/bin/env bash
#
# Keeper loop: deploy idle underlying into strategies, then harvest their yield.
#
# The keeper role is operationally hot but economically powerless — it can only move funds between
# the vault and already-registered strategies, and only the admin can register one. That is why it
# is safe to run this from a cron job with a key on a server.
#
# Usage:
#   SOURCE=nebula-keeper ./scripts/keeper.sh            # one pass
#   SOURCE=nebula-keeper WATCH=300 ./scripts/keeper.sh  # repeat every 300s

set -euo pipefail

cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:?set SOURCE to the keeper identity}"
DEPLOYMENT="deployments/${NETWORK}.json"

[ -f "$DEPLOYMENT" ] || { echo "No deployment found at $DEPLOYMENT — run scripts/deploy.sh first" >&2; exit 1; }

VAULT="$(sed -n 's/.*"vault": "\([^"]*\)".*/\1/p' "$DEPLOYMENT")"

invoke() {
  stellar contract invoke \
    --id "$VAULT" \
    --source "$SOURCE" \
    --network "$NETWORK" \
    -- "$@"
}

pass() {
  printf '\033[1;36m==>\033[0m %s\n' "$(date -u +%FT%TZ)"

  echo "  total assets: $(invoke total_assets)"
  echo "  share price:  $(invoke share_price)"
  echo "  idle:         $(invoke idle)"

  # allocate first: yield only accrues on capital that is actually deployed.
  invoke allocate >/dev/null && echo "  allocated"
  echo "  harvested:    $(invoke harvest)"
  echo "  share price:  $(invoke share_price)"
}

if [ -n "${WATCH:-}" ]; then
  while true; do
    pass || echo "  pass failed, retrying next tick" >&2
    sleep "$WATCH"
  done
else
  pass
fi
