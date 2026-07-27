# Nebula — Liquid Yield for XLM

Deposit XLM, receive **nXLM**, keep full liquidity while the protocol earns yield on your behalf.

nXLM is a value-accruing token: your balance never changes, but each nXLM becomes redeemable for
more XLM over time. It trades on SDEX, moves through path payments, and works as collateral in
Soroban protocols — all while earning.

> **Status:** live on Stellar testnet, earning real interest from a Blend pool. Frontend and
> indexer next. See [`docs/SUCCESS_METRICS.md`](docs/SUCCESS_METRICS.md) for the build plan.

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
    ├── blend/         Supplies XLM to a Blend lending pool, harvests borrower interest
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

### The Blend strategy

Supplies XLM to a Blend lending pool and earns borrower interest. Two deliberate limits:

- **Supply, never collateral.** Blend distinguishes `Supply` from `SupplyCollateral`; only the
  latter backs borrowing and carries a health factor. Nebula never borrows, so its position cannot
  be liquidated and is withdrawable whenever the pool holds cash.
- **Harvest realizes interest, not emissions.** Interest accrues in XLM itself — the bToken rate
  rises — so `harvest` withdraws exactly the surplus above cost basis and leaves the principal
  working. BLND emissions are a different asset needing a DEX route to become XLM; until that
  exists, `claim_emissions` sends them to the treasury and deliberately does **not** feed the share
  price. Counting an asset the vault cannot redeem into would inflate the price against XLM it
  does not hold.

Blend publishes `blend-contract-sdk`, but it pins `soroban-sdk 25` against Nebula's 26 — two major
SDK versions cannot link into one contract. The adapter mirrors the handful of Blend types it
touches instead, which also avoids coupling Nebula to Blend's release cadence.

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
cargo test --workspace     # 57 tests
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

### Register the Blend strategy

```bash
SOURCE=nebula-deployer BLEND_POOL=<pool address> ./scripts/add-blend-strategy.sh
```

Deploys the strategy against a specific Blend pool and registers it with the vault. `BLEND_POOL`
is deliberately not defaulted — there is no canonical testnet pool, and pointing the vault at the
wrong one should be a conscious act. The vault verifies the strategy's underlying matches its own
before accepting it.

### Run the keeper

```bash
SOURCE=nebula-keeper WATCH=300 ./scripts/keeper.sh
```

Allocates idle XLM above the reserve target, then harvests. Safe to run unattended: the keeper can
only move funds between the vault and already-registered strategies.

---

## Contract addresses

Stellar **testnet**. Machine-readable copy in [`deployments/testnet.json`](deployments/testnet.json).

| Contract | Address |
|---|---|
| Vault | [`CDGRL2EM…3VXTUPHO`](https://stellar.expert/explorer/testnet/contract/CDGRL2EMFMLOCD6NRUKCL6CPNAF4SWK4DLQIM2AGFIN5P5CK3VXTUPHO) |
| nXLM share token | [`CAVRFADY…DZ5JB3SN2`](https://stellar.expert/explorer/testnet/contract/CAVRFADYBNPLRL734VGRS6FW4LXRDEKRZZDQCSMB7VXCFZPDZ5JB3SN2) |
| Blend strategy | [`CDSQOX3G…GL5DAYQAR`](https://stellar.expert/explorer/testnet/contract/CDSQOX3GQSE4HEM5IWKEMIZ56JHMTPFN3ZUN5PI4TH5WVFYGL5DAYQAR) |
| Blend pool (upstream) | [`CCEBVDYM…KHPQ44HGF`](https://stellar.expert/explorer/testnet/contract/CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF) |
| Underlying — native XLM SAC | [`CDLZFC3S…VU2HHGCYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

### Verified live on testnet

Every path exercised against the real Blend pool, not a stand-in:

| Path | Result |
|---|---|
| Deposit | 100 XLM in → 999,999,000 nXLM minted, 1,000 dead shares locked in the vault |
| Redeem from reserve | Served from idle without touching the strategy |
| Allocate | 54 XLM supplied to Blend → 331,026,297 bTokens at `b_rate` 1.631284927567 |
| Harvest | Real interest: gross 1,789 stroops, fee 178, net 1,611 → **share price 10000000 → 10000026** |
| Redeem forcing unwind | Pulled 239,999,194 back out of Blend mid-redemption |
| Invariant | `total_assets == idle + Σ deployed` held after every operation |

The allowance-based deposit path — the one thing local tests could not prove, because
`mock_all_auths` makes every `require_auth` succeed — **works on-chain.** The transfer, `approve`,
and Blend `supply` events all fired in one transaction with no `authorize_as_current_contract`.

---

## Testing

57 tests covering the accounting, the access control, and the attacks:

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
| Blend adapter | Supply, interest accrual, harvest leaving principal working, partial withdrawal when the pool is short on cash, liquidity-bounded `max_withdrawable` |

Every state-changing vault test asserts the `total_assets == idle + Σ deployed` invariant
afterwards.

The Blend adapter is tested against a local stand-in that models a rising bToken rate. That covers
the accounting but **not** the authorization path — `mock_all_auths` makes every `require_auth`
succeed, so the allowance grant in `deposit` is exercised for its token effects, not its auth
semantics. That gap is closed by the live testnet run above, where the real pool enforced real auth.

```bash
cargo test --workspace
```

---

## Documentation

| Document | What's in it |
|---|---|
| [`NEBULA.md`](NEBULA.md) | Source of truth — mechanism design, yield sources, decisions, risks |
| [`docs/SUCCESS_METRICS.md`](docs/SUCCESS_METRICS.md) | Level 4 requirement tracker and build plan |
| [`indexer/README.md`](indexer/README.md) | Event indexer — setup, commands, and the two RPC gotchas |

## Indexer

`indexer/` ingests vault events into Postgres and is what makes the dashboard and the usage
evidence possible:

```bash
cd indexer && npm install && cp .env.example .env
npm run migrate && npm run sync
npm run stats        # TVL, share price, depositor count, realized APY
npm run depositors   # every depositing address, with tx hashes
```

It runs every 10 minutes from GitHub Actions. That schedule matters more than it looks: Soroban
RPC discards events after roughly a week, and a gap cannot be backfilled once they are gone — so
the record of who used the protocol has to be captured as it happens.

---

## License

Apache-2.0
