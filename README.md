# Nebula — Liquid Yield for XLM

Deposit XLM, receive **nXLM**, keep full liquidity while the protocol earns yield on your behalf.

nXLM is a value-accruing token: your balance never changes, but each nXLM becomes redeemable for
more XLM over time. It trades on SDEX, moves through path payments, and works as collateral in
Soroban protocols — all while earning.

> **Status:** contracts complete and tested, testnet deployment pending. See
> [`docs/SUCCESS_METRICS.md`](docs/SUCCESS_METRICS.md) for the build plan.

---

## The problem

XLM is dead capital. Real yield exists on Stellar — Blend lending markets, Aquarius liquidity
incentives — but using it means supplying to pools by hand, claiming AQUA emissions, swapping
them, and re-depositing. Most holders never do, so their realized yield is far below the headline
number, and the position they end up with isn't liquid or spendable.

Nebula collapses that into one token.

### A note on "staking"

Nebula is **not** a liquid staking protocol, because Stellar has no protocol staking to wrap. The
Stellar Consensus Protocol is Federated Byzantine Agreement, not proof-of-stake: validators bond
nothing, earn no block rewards, and cannot be slashed. The inflation mechanism was disabled in
Protocol 12 in October 2019.

Yield here comes from real DeFi venues, and the vocabulary reflects that — *strategies*, not
validators. See [`NEBULA.md`](NEBULA.md) §0 for the full reasoning.

---

## How it works

```
   Deposit XLM ──▶ Vault mints nXLM at the current share price
                        │
                        ▼
              Keeper allocates across strategies
              ┌─────────┼──────────┐
              ▼         ▼          ▼
           Blend     Aquarius    Reserve
         (lending)  (AMM+AQUA)  (instant exit)
              │         │          │
              └─────────┼──────────┘
                        ▼
          Harvest: claim rewards, swap to XLM,
          credit to the vault → share price ↑
                        │
      ┌─────────────────┼─────────────────┐
      ▼                 ▼                 ▼
  Hold & accrue    Trade on SDEX     Redeem for XLM
                   / path payment     (+ accrued yield)
```

### Share price

```
share_price = total_assets / total_supply     (XLM per nXLM)

mint:    shares_out = assets_in * total_supply / total_assets
redeem:  assets_out = shares_in * total_assets / total_supply
```

Both conversions round **down**, so every rounding remainder accrues to the vault and therefore to
the remaining holders. An off-by-one favouring the caller is drainable in a loop, which is why the
direction is load-bearing rather than cosmetic.

### The invariant

```
total_assets == idle + Σ strategy.deployed
```

`total_assets` is tracked in contract state and is **never** read from a live token balance. That
one choice makes the classic first-depositor ("inflation") attack structurally impossible: XLM
donated directly to the vault address does not enter `total_assets`, so it cannot move the share
price. Yield is recognized only through `harvest`, and only in the amount the vault *measured*
arriving — a strategy that reports a gain it did not deliver is rejected.

Belt and braces on top of that: a virtual offset in every conversion, and 1000 dead shares locked
at first deposit so total supply can never sit low enough for share rounding to be exploitable.

---

## Architecture

```
contracts/
├── interfaces/        Strategy + ShareToken traits — the seam between vault and venues
├── nxlm-token/        SEP-41 share token. Minter fixed to the vault at construction.
├── vault/             Deposits, redemptions, share price, allocation, harvest, registry
└── strategies/
    └── mock/          Controllable strategy: test double and Blend-unavailable fallback
```

Every yield venue implements the same five-function trait, so adding Blend or Aquarius is a new
contract rather than a vault change:

```rust
pub trait Strategy {
    fn deposit(env: Env, amount: i128);
    fn withdraw(env: Env, amount: i128) -> i128;
    fn harvest(env: Env) -> i128;
    fn total_assets(env: Env) -> i128;
    fn max_withdrawable(env: Env) -> i128;
}
```

### Roles

| Role | Can | Cannot |
|---|---|---|
| **User** | Deposit, redeem, transfer nXLM | — |
| **Keeper** | `allocate`, `harvest`, `unwind` | Register strategies, move funds out of the vault |
| **Admin** | Register/pause strategies, set fee and reserve, pause deposits, sweep donations | Mint nXLM, block redemptions, take user funds |

**Redemptions are never pausable.** A vault that can trap funds is a custodian, and Nebula is not
one.

---

## Getting started

### Prerequisites

- Rust 1.85+ with the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 23+

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

### Build and test

```bash
cargo test --workspace     # 45 tests
stellar contract build     # release wasm for all contracts
```

### Deploy to testnet

```bash
stellar keys generate --network testnet nebula-deployer
SOURCE=nebula-deployer ./scripts/deploy.sh
```

The script derives the vault's address from a salt, deploys the share token bound to that address,
then deploys the vault to it — the token's minter is immutable, so the pair must be deployed in
that order. The vault verifies the binding on-chain and the deployment fails if it does not match.

Addresses are written to `deployments/testnet.json`.

### Run the keeper

```bash
SOURCE=nebula-keeper WATCH=300 ./scripts/keeper.sh
```

Allocates idle XLM above the reserve target, then harvests. Safe to run unattended: the keeper can
only move funds between the vault and already-registered strategies.

---

## Contract addresses

| Contract | Testnet |
|---|---|
| Vault | _pending deployment_ |
| nXLM token | _pending deployment_ |
| Underlying (native XLM SAC) | _pending deployment_ |

---

## Testing

45 tests covering the accounting, the access control, and the attacks:

| Area | Covered |
|---|---|
| Deposit / redeem | Round trip, dilution, dust rejection, dead-share lock |
| Inflation attack | Donation cannot move the share price; donations are sweepable, not stranded |
| Rounding | Never favours the caller, at a deliberately awkward share price |
| Strategies | Weight splitting, caps, pausing, asset mismatch, over-100% weights |
| Yield | Share price rises on harvest, fee taken off the top, over-reporting rejected |
| Liquidity | Redemption unwinds strategies; fails cleanly and atomically when illiquid |
| Access control | Admin/keeper separation, non-removable funded strategies |
| Lifecycle | Two depositors across two harvests, late joiner cannot claim earlier yield |

Every state-changing test asserts the `total_assets == idle + Σ deployed` invariant afterwards.

```bash
cargo test --workspace
```

---

## Documentation

| Document | What's in it |
|---|---|
| [`NEBULA.md`](NEBULA.md) | Source of truth — mechanism design, yield sources, decisions, risks |
| [`docs/SUCCESS_METRICS.md`](docs/SUCCESS_METRICS.md) | Level 4 requirement tracker and build plan |

---

## License

Apache-2.0
