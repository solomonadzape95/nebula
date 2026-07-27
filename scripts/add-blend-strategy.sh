#!/usr/bin/env bash
#
# Deploy the Blend strategy and register it with the vault.
#
# Run after scripts/deploy.sh. Two steps, both of which must succeed:
#   1. deploy the strategy, bound to the vault and a specific Blend pool
#   2. register it with the vault (admin-authorized), setting its weight and cap
#
# The vault checks that the strategy's underlying matches its own before accepting it, so pointing
# this at a pool for the wrong asset fails at registration rather than silently misallocating.
#
# Usage:
#   SOURCE=nebula-deployer BLEND_POOL=C... ./scripts/add-blend-strategy.sh
#
# Required:
#   SOURCE       admin identity — registration is admin-authorized
#   BLEND_POOL   address of the Blend pool holding an XLM reserve.
#                Find one at https://mainnet.blend.capital (switch to testnet) or via the pool
#                factory. There is no canonical testnet pool, so this is deliberately not defaulted.
# Optional:
#   NETWORK      defaults to testnet
#   WEIGHT_BPS   share of deployable assets, defaults to 10000 (100%)
#   CAP          max underlying this strategy may hold, in stroops. Defaults to 0 (uncapped).

set -euo pipefail

cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:?set SOURCE to the vault admin identity}"
BLEND_POOL="${BLEND_POOL:?set BLEND_POOL to a Blend pool address with an XLM reserve}"
WEIGHT_BPS="${WEIGHT_BPS:-10000}"
CAP="${CAP:-0}"
WASM_DIR="target/wasm32v1-none/release"
DEPLOYMENT="deployments/${NETWORK}.json"

log() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
field() { sed -n "s/.*\"$1\": \"\([^\"]*\)\".*/\1/p" "$DEPLOYMENT"; }

[ -f "$DEPLOYMENT" ] || { echo "No deployment at $DEPLOYMENT — run scripts/deploy.sh first" >&2; exit 1; }

VAULT="$(field vault)"
UNDERLYING="$(field underlying)"

log "Building contracts"
stellar contract build >/dev/null

log "Deploying Blend strategy against pool ${BLEND_POOL}"
STRATEGY="$(stellar contract deploy \
  --wasm "$WASM_DIR/nebula_strategy_blend.wasm" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --underlying "$UNDERLYING" \
  --vault "$VAULT" \
  --pool "$BLEND_POOL")"

log "Registering ${STRATEGY} with the vault at ${WEIGHT_BPS}bps"
stellar contract invoke \
  --id "$VAULT" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- add_strategy \
  --address "$STRATEGY" \
  --weight_bps "$WEIGHT_BPS" \
  --cap "$CAP"

log "Registered strategies:"
stellar contract invoke --id "$VAULT" --source "$SOURCE" --network "$NETWORK" -- strategies

echo
echo "  Strategy: https://stellar.expert/explorer/${NETWORK}/contract/${STRATEGY}"
echo
echo "  Next: SOURCE=<keeper> ./scripts/keeper.sh   # allocate, then harvest"
