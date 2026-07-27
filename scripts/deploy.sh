#!/usr/bin/env bash
#
# Deploy the Nebula contracts to a Stellar network (testnet by default).
#
# The share token fixes its minter at construction and the vault refuses a share token that does
# not name it, so the two must be deployed to a matching pair of addresses. That chicken-and-egg
# is resolved by deploying the vault to a *salted* address: the address is derived from
# (source account, salt) and can therefore be computed before the vault exists.
#
#   1. compute the vault's future address from the salt
#   2. deploy the token, naming that address as minter
#   3. deploy the vault to that exact address, naming the token
#
# Step 3 verifies the binding on-chain. A mismatch fails the deployment instead of producing a
# live vault that can never mint.
#
# Usage:
#   NETWORK=testnet SOURCE=nebula-deployer ./scripts/deploy.sh
#
# Required:
#   SOURCE          stellar CLI identity or secret key that pays for and signs the deployment
# Optional:
#   NETWORK         defaults to testnet
#   ADMIN           defaults to SOURCE's public key
#   KEEPER          defaults to ADMIN
#   FEE_RECIPIENT   defaults to ADMIN
#   FEE_BPS         protocol fee on harvested yield, defaults to 1000 (10%)
#   RESERVE_BPS     idle reserve target, defaults to 1000 (10%)
#   DEPOSIT_CAP     vault cap in stroops, defaults to 1000000 XLM. 0 means uncapped.
#   VAULT_SALT      64 hex chars. Defaults to a fresh random salt.

set -euo pipefail

cd "$(dirname "$0")/.."

NETWORK="${NETWORK:-testnet}"
SOURCE="${SOURCE:?set SOURCE to a stellar CLI identity, e.g. SOURCE=nebula-deployer}"
FEE_BPS="${FEE_BPS:-1000}"
RESERVE_BPS="${RESERVE_BPS:-1000}"
DEPOSIT_CAP="${DEPOSIT_CAP:-10000000000000}" # 1,000,000 XLM in stroops
WASM_DIR="target/wasm32v1-none/release"
OUT="deployments/${NETWORK}.json"

log() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }

SOURCE_PUBKEY="$(stellar keys public-key "$SOURCE" 2>/dev/null || echo "$SOURCE")"
ADMIN="${ADMIN:-$SOURCE_PUBKEY}"
KEEPER="${KEEPER:-$ADMIN}"
FEE_RECIPIENT="${FEE_RECIPIENT:-$ADMIN}"
VAULT_SALT="${VAULT_SALT:-$(openssl rand -hex 32)}"

log "Building contracts"
stellar contract build >/dev/null

log "Resolving native XLM Stellar Asset Contract on ${NETWORK}"
UNDERLYING="$(stellar contract id asset --asset native --network "$NETWORK")"

log "Computing the vault's address from salt ${VAULT_SALT:0:16}…"
VAULT_ID="$(stellar contract id wasm \
  --salt "$VAULT_SALT" \
  --source-account "$SOURCE" \
  --network "$NETWORK")"

log "Deploying nXLM share token, minter locked to ${VAULT_ID}"
SHARE_TOKEN="$(stellar contract deploy \
  --wasm "$WASM_DIR/nxlm_token.wasm" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  -- \
  --minter "$VAULT_ID" \
  --decimals 7 \
  --name "Nebula Staked XLM" \
  --symbol "nXLM")"

log "Deploying vault to its precomputed address"
DEPLOYED_VAULT="$(stellar contract deploy \
  --wasm "$WASM_DIR/nebula_vault.wasm" \
  --source "$SOURCE" \
  --network "$NETWORK" \
  --salt "$VAULT_SALT" \
  -- \
  --underlying "$UNDERLYING" \
  --share_token "$SHARE_TOKEN" \
  --admin "$ADMIN" \
  --keeper "$KEEPER" \
  --fee_recipient "$FEE_RECIPIENT" \
  --fee_bps "$FEE_BPS" \
  --reserve_bps "$RESERVE_BPS" \
  --deposit_cap "$DEPOSIT_CAP")"

if [ "$DEPLOYED_VAULT" != "$VAULT_ID" ]; then
  echo "FATAL: vault deployed to $DEPLOYED_VAULT but the token was bound to $VAULT_ID" >&2
  exit 1
fi

mkdir -p deployments
cat > "$OUT" <<JSON
{
  "network": "${NETWORK}",
  "vault": "${VAULT_ID}",
  "shareToken": "${SHARE_TOKEN}",
  "underlying": "${UNDERLYING}",
  "admin": "${ADMIN}",
  "keeper": "${KEEPER}",
  "feeRecipient": "${FEE_RECIPIENT}",
  "params": {
    "feeBps": ${FEE_BPS},
    "reserveBps": ${RESERVE_BPS},
    "depositCap": ${DEPOSIT_CAP}
  },
  "vaultSalt": "${VAULT_SALT}"
}
JSON

log "Done. Wrote ${OUT}"
cat "$OUT"

EXPLORER="https://stellar.expert/explorer/${NETWORK}/contract"
echo
echo "  Vault:       ${EXPLORER}/${VAULT_ID}"
echo "  Share token: ${EXPLORER}/${SHARE_TOKEN}"
