# Nebula — Liquid Yield for XLM

Deposit XLM, receive **nXLM**, keep full liquidity while the protocol earns yield on your behalf.

nXLM is a value-accruing token: your balance never changes, but each nXLM becomes redeemable for
more XLM over time. It trades on SDEX, moves through path payments, and works as collateral in
Soroban protocols — all while earning.

> **Status:** live on Stellar testnet, earning real interest from a Blend pool. Contracts, indexer
> and web app are all built; the interface is deployed at
> [nebula.thesolenoid.space](https://nebula.thesolenoid.space) and the indexer syncs on a schedule
> into hosted Postgres. The contracts below are the post-security-pass build, deployed 2026-08-14.
> Unaudited — testnet only, and see [Security](#security) for what would have to change before it
> held real money.

**[▶ Live app](https://nebula.thesolenoid.space) · [Contracts on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDONRBWSSLXWLB7YN6SI4MDBIFTXBKBZTKOGRL537LP4RGAIXDLBHMQX) · [On-chain record](evidence/) · [Security](#security)**

| | |
|---|---|
| **Live app** | [nebula.thesolenoid.space](https://nebula.thesolenoid.space) |
| **Watch it work, no wallet needed** | The landing page reads live TVL, share price and the price history straight off testnet — connecting is only needed to deposit |
| **Try it yourself** | Fund a testnet wallet at [friendbot](https://friendbot.stellar.org), connect, deposit XLM, watch the share price rise on the next harvest, redeem |
| **On-chain record** | [`evidence/`](evidence/) — every depositor and transaction as CSV, each row with its own explorer link |

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

### Why Stellar

Not incidental to the design — three properties of the network are load-bearing here:

- **Sub-cent, deterministic fees make harvesting viable.** A vault's yield is the gross return minus
  the cost of collecting it. The harvests below realized amounts in the hundreds of stroops; on a
  chain where a keeper transaction costs a dollar, every one of them would have been a net loss, and
  the whole compounding loop would only work at a size Nebula does not have yet.
- **nXLM is liquid the moment it exists.** SEP-41 tokens trade on SDEX and route through path
  payments without a pool being bootstrapped first, so "keep your liquidity" is a property of the
  network rather than a promise about a future listing.
- **XLM is the largest pool of idle capital on the network**, and unlike a proof-of-stake chain
  Stellar offers its holders nothing for holding it — no staking, no block rewards, no inflation
  since Protocol 12. The gap this fills exists specifically because of how consensus works here.

---

## How it works

```
   Deposit XLM ──▶ Vault mints nXLM at the current share price
                        │
                        ▼
              Keeper allocates above the reserve target
              ┌────────────────────┐
              ▼                    ▼
           Blend                Reserve
         (lending)           (instant exit)
              │                    │
              └─────────┬──────────┘
                        ▼
        Harvest: sweep interest, mark each venue
        to market, credit the rest → share price ↕
                        │
      ┌─────────────────┼─────────────────┐
      ▼                 ▼                 ▼
  Hold & accrue    Trade on SDEX     Redeem for XLM
                   / path payment     (+ accrued yield)
```

One strategy ships today. The seam takes more (see [Adding a venue](#adding-a-venue)), and
**Aquarius was evaluated and deliberately left out**: it is an AMM, so supplying to it means taking
on impermanent loss, and a vault whose pitch is "deposit XLM, get more XLM" should not quietly
become one that can return less of it than you put in. That belongs in a second, clearly-labelled
vault rather than behind the same token.

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

### Losses are recognized, not deferred

`deployed` is a cost basis, so on its own the vault cannot tell a strategy sitting on its principal
apart from one that has lost half of it. `mark_to_market` runs at the top of **deposit, redeem and
harvest**: any shortfall between what a venue holds and what the vault deployed there is written off
against `total_assets` before the share price is quoted.

Doing it on every priced action is the point. If a loss were only recognized at harvest, the first
holders to redeem after a drawdown would be paid at the old price out of everyone else's principal,
and the stragglers would find the vault empty. Charging it to every share at the same instant means
leaving early buys nothing. It also closes the case where a strategy hands back principal and calls
it yield — both are the same write-down, so the vault never has to trust a venue to classify its own
shortfall honestly. The share price can therefore fall, and a `strategy_loss` event says why.

---

## Architecture

Four pieces, deployed independently:

```
contracts/             Soroban, Rust — the protocol itself
├── interfaces/        Strategy + ShareToken traits — the seam between vault and venues
├── nxlm-token/        SEP-41 share token. Minter fixed to the vault at construction.
├── vault/             Deposits, redemptions, share price, allocation, harvest, registry
└── strategies/
    ├── blend/         Supplies XLM to a Blend lending pool, harvests borrower interest
    └── mock/          Controllable test double. Its levers are behind a `testutils`
                       feature so they cannot reach a deployable wasm.

indexer/               TypeScript — reads vault events from Soroban RPC into Postgres.
                       Runs on a schedule from GitHub Actions, not a server.

web/                   Next.js 16 — the interface. Reads the chain directly for live
                       figures and the indexer for history. Deployed to Vercel.

scripts/               Deploy, register a strategy, run the keeper, seed testnet.
```

### Adding a venue

Every yield source implements one trait, so a new venue is a new contract rather than a change to
the vault:

```rust
pub trait Strategy {
    /// The asset this venue takes. The vault refuses to register a mismatch.
    fn underlying(env: Env) -> Address;
    /// The one vault allowed to instruct it. Checked at registration, so assets
    /// cannot be pushed somewhere this vault could never pull them back from.
    fn vault(env: Env) -> Address;

    fn deposit(env: Env, amount: i128);
    fn withdraw(env: Env, amount: i128) -> i128;
    fn harvest(env: Env) -> i128;
    fn total_assets(env: Env) -> i128;
    fn max_withdrawable(env: Env) -> i128;
}
```

Semantics are **push**: the vault transfers the asset first and then instructs the strategy, so a
venue never pulls from the vault and never holds an allowance against it.

### Roles

| Role | Can | Cannot |
|---|---|---|
| **User** | Deposit, redeem, transfer nXLM | — |
| **Keeper** | `allocate`, `harvest`, `unwind` | Register strategies, send funds anywhere but a registered venue |
| **Admin** | Register/pause strategies, set fee (capped at 20%) and reserve, pause deposits, sweep donations, rotate the keeper | Mint nXLM, block redemptions, touch the dead-share lock, take the reserve directly |

**Redemptions are never pausable.** A vault that can trap funds is a custodian, and Nebula is not
one. `sweep` reaches only the surplus above `idle`, and refuses the share token outright, so it
cannot be used to reach accounted funds or unwind the dead-share lock.

**The admin key is still the largest trust assumption here, and the table above should not be read
as saying otherwise.** Registering a strategy is by definition the power to send vault assets to a
contract of the admin's choosing, and the registration checks — matching underlying, matching vault
— constrain which contract, not whose. There is no timelock, so a parameter change or a new venue
lands in the same ledger it is signed in. On testnet that is a reasonable trade for iteration speed.
Before real money it needs a timelock on `add_strategy` and `set_keeper`, a multisig on the admin
key, and an external audit. See [Security](#security).

### The Blend strategy

Supplies XLM to a Blend lending pool and earns borrower interest. Two deliberate limits:

- **Supply, never collateral.** Blend distinguishes `Supply` from `SupplyCollateral`; only the
  latter backs borrowing and carries a health factor. Nebula never borrows, so its position cannot
  be liquidated and is withdrawable whenever the pool holds cash.
- **Harvest realizes interest, not emissions.** Interest accrues in XLM itself — the bToken rate
  rises — so `harvest` withdraws exactly the surplus above cost basis and leaves the principal
  working. BLND emissions are a different asset needing a DEX route to become XLM, and counting an
  asset the vault cannot redeem into would inflate the price against XLM it does not hold.

  `claim_emissions` exists on the strategy but is **currently unreachable**, and the honest reading
  is that BLND is accruing to the position with no way to collect it. It authorizes against the
  vault, and a contract can only be authorized for calls it makes itself — so the only possible
  caller is the vault, which has no entry point that forwards to it. Collecting emissions needs
  either a keeper-gated pass-through on the vault or a strategy-local treasury address set at
  construction. It affects yield, not safety: nothing depends on it, and the share price already
  ignores emissions by design.

Blend publishes `blend-contract-sdk`, but it pins `soroban-sdk 25` against Nebula's 26 — two major
SDK versions cannot link into one contract. The adapter mirrors the handful of Blend types it
touches instead, which also avoids coupling Nebula to Blend's release cadence.

---

## Getting started

### Prerequisites

- Rust 1.85+ with the `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) 23+
- Node 22+ and a Postgres database, for the indexer and the web app

```bash
rustup target add wasm32v1-none
cargo install --locked stellar-cli
```

### Build and test

```bash
cargo test --workspace     # 64 tests
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
wrong one should be a conscious act. The vault verifies both that the strategy's underlying matches
its own and that the strategy names this vault as its owner before accepting it.

### Run the web app

```bash
cd web && npm install
cp .env.example .env.local     # fill in DATABASE_URL and ADMIN_PASSWORD at minimum
npm run dev
```

Live vault figures are read straight from the contracts by simulating a transaction — Soroban has no
read endpoint, so a "read" is a simulation whose result is discarded. History, profiles and feedback
come from the indexer's Postgres. Both degrade independently: if RPC is unreachable the page says so
rather than showing a stale number, and if the database is down the live figures still render.

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
| Vault | [`CDONRBWS…IXDLBHMQX`](https://stellar.expert/explorer/testnet/contract/CDONRBWSSLXWLB7YN6SI4MDBIFTXBKBZTKOGRL537LP4RGAIXDLBHMQX) |
| nXLM share token | [`CAEEI27X…K5NI464CT`](https://stellar.expert/explorer/testnet/contract/CAEEI27XLJHMJBI25PL36DJ7FEK6TMVCQ7TP2PRQ4EXFVOUK5NI464CT) |
| Blend strategy | [`CATKCADB…N5DO2FI5DU`](https://stellar.expert/explorer/testnet/contract/CATKCADBXINDP45VLR27GZDNJSUPAZNNADCMT6XYBAH2AEN5DO2FI5DU) |
| Blend pool (upstream) | [`CCEBVDYM…KHPQ44HGF`](https://stellar.expert/explorer/testnet/contract/CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF) |
| Underlying — native XLM SAC | [`CDLZFC3S…VU2HHGCYSC`](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |

### Verified live on testnet

Every path exercised against the real Blend pool, not a stand-in. Reproduce with
`./scripts/smoke-test.sh` — the figures below are one run of it against the contracts above:

| Path | Result |
|---|---|
| Deposit | 100 XLM in → 99.9999000 nXLM minted, 1,000 dead shares locked in the vault |
| Allocate | 89.9999999 XLM supplied to Blend, 10 XLM held back as the redemption reserve |
| Harvest | Real borrower interest: 0.0000607 XLM credited net of the 10% fee → **share price 1.0000000 → 1.0000006** |
| Redeem forcing unwind | Full position returned 99.9999606 XLM, pulled back out of Blend mid-redemption |
| Invariant | `total_assets == idle + Σ deployed` held after every operation |

That last row is worth reading honestly: a round trip taken minutes apart comes back **0.0000394 XLM
short**, because share rounding always resolves against the redeemer and a few minutes in the pool
does not out-earn it. The vault is not a place to park money for an hour, and the smoke test prints
the negative rather than hiding it.

The allowance-based deposit path — the one thing local tests could not prove, because
`mock_all_auths` makes every `require_auth` succeed — **works on-chain.** The transfer, `approve`,
and Blend `supply` events all fired in one transaction with no `authorize_as_current_contract`.

---

## Traction

**The contracts were redeployed on 2026-08-14 to pick up the security pass, and the event history
starts again from there.** The figures below are what the new vault has done since — which is one
end-to-end smoke test and nothing else yet.

*Exported from the indexer. Regenerate with `cd indexer && npm run export`.*

| | |
|---|---|
| Depositing addresses | 1 — the project's own test account |
| External users | **0** |
| Contract tests | 64 passing |
| Full cycle verified on-chain | Yes — deposit, allocate, harvest, redeem, see above |

The previous deployment indexed 11 depositors and 17 transactions across 4,692 XLM. Every one of
those addresses was self-generated — funded minutes apart from the same faucet while the deposit
path was being tested — and `days_active` read `1` for all of them, which is what a scripted batch
looks like. That record proved the plumbing: indexing, accounting, the harvest loop, and the
invariant holding across real transactions. It never proved a user base, and it is not carried
forward here, because a retired vault's numbers presented as current traction would be exactly the
kind of figure this project refuses to publish.

The live record is in [`evidence/`](evidence/) as CSV — one file per wallet, one per transaction,
one per harvest — and **every activity row carries its own transaction hash and Stellar Expert
link.** Nothing there is typed in by hand; it is a rendering of decoded Soroban events, so any
single row can be checked against a ledger this project does not control, and there is no code path
that can add a row the chain did not produce.

Identity is the half no ledger can carry. An address is free to create and a funded testnet wallet
costs nothing, so the export deliberately reports `days_active` rather than filtering on it — a
batch driven from one script in one sitting is visible as such.
[`docs/USER_SURVEY.md`](docs/USER_SURVEY.md) is the other half: it collects a wallet address
alongside a person, so each response joins to a row in `depositors.csv` and a claim that does not
match the chain is visible on sight.

---

## Testing

64 tests covering the accounting, the access control, and the attacks:

| Area | Covered |
|---|---|
| Deposit / redeem | Round trip, dilution, dust rejection, dead-share lock |
| Inflation attack | Donation cannot move the share price; donations are sweepable, not stranded |
| Rounding | Never favours the caller, at a deliberately awkward share price |
| Strategies | Weight splitting, caps, pausing, asset mismatch, over-100% weights |
| Yield | Share price rises on harvest, fee taken off the top, over-reporting rejected |
| Liquidity | Redemption unwinds strategies; fails cleanly and atomically when illiquid |
| Access control | Admin/keeper separation, non-removable funded strategies, strategy bound to another vault rejected, share token not sweepable, burn requires the vault |
| Drawdowns | Harvest writes a venue loss down, a loss is split across holders instead of paid to whoever redeems first, depositing after an unreported loss buys in at the lowered price, no fee on a losing period |
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

## Analytics & monitoring

PostHog, self-proxied, covering both product analytics and error tracking.

**One vendor, deliberately.** The obvious alternative is PostHog for funnels and Sentry for errors.
PostHog captures `$exception` events with stack traces and issue grouping, and putting both on one
timeline is worth more here than Sentry's deeper error tooling: the question this project actually
needs answered is *"the deposit funnel leaks at signing — what threw?"*, and with two vendors that
is a manual identity reconciliation across two dashboards. With one it is a click. A second SDK
would also be a second script on a page whose users disproportionately run blockers.

| Piece | Where |
|---|---|
| Browser events + pageviews | [`web/instrumentation-client.ts`](web/instrumentation-client.ts) |
| Browser exceptions | same file — `capture_exceptions`, unhandled errors and rejections |
| Server exceptions | [`web/instrumentation.ts`](web/instrumentation.ts) — Next's `onRequestError` |
| Typed event names | [`web/lib/analytics.ts`](web/lib/analytics.ts) |
| Funnel drop-off panel | `/asdfg/admin` — joins PostHog's funnel to on-chain depositors |

**Requests go to `/ingest` on our own origin** and are rewritten to PostHog in
[`web/next.config.ts`](web/next.config.ts). A direct call to a posthog.com host is blocked by uBlock
Origin and Brave's shields, and this audience runs those far above the general web's rate — so the
missing data would not be missing at random, it would be exactly the privacy-minded users, which is
most of the point of measuring a crypto product.

Event names are a compile-checked union, so a typo cannot silently split one funnel into two:

```
wallet_connect_started / wallet_connected / wallet_connect_failed   { wallet, reason }
deposit_submitted / deposit_confirmed / deposit_failed              { size, phase, reason }
withdraw_submitted / withdraw_confirmed / withdraw_failed           { size, phase, reason }
username_set · review_submitted                                     { rating }
```

Two deliberate departures from what a default install would send. **No wallet address and no exact
amount** — the [privacy page](https://nebula.thesolenoid.space/privacy) promises analytics is not
tied to your address, and an exact figure plus a timestamp identifies one transaction on a public
ledger, so amounts go as bands (`<10`, `10-100`, `100-1k`). **`deposit_failed` carries the phase it
died in** — `simulating`, `signing`, `submitting`, `confirming`. Backing out at the wallet prompt
and the contract rejecting you look identical in a funnel and need opposite responses.

Session recording is off. On a page where people type amounts and approve wallet prompts it is a
lot of exposure for a question the funnel already answers.

---

## Security

Nebula is **unaudited and on testnet.** Everything below is the current posture, not a claim that
it is ready for real money.

### On chain

- **Redemption is never pausable**, and `mark_to_market` means the price it pays already reflects
  any venue loss, so exiting first is not an advantage.
- **The minter is immutable.** `nXLM` binds it at construction with no rotation entry point, so
  holders trust the vault contract rather than an operator. Burning requires the vault too — a
  bypassing burn would leave `total_shares` counting shares nobody holds and strand the XLM behind
  them.
- **Fees are capped at 20%** and validated in both the constructor and `set_params`. They apply
  only to harvested gains, never to principal, and not at all in a period that lost money.
- **Overflow-checked arithmetic** throughout, with explicit checked helpers and no unchecked casts.

### Off chain

- **The admin surface** sits behind an obscure prefix, an address allowlist, and a password compared
  server-side. The session cookie is HMAC-signed with the expiry inside the signed payload, so it
  cannot be forged by sending a header. Requests are rewritten away before the page renders, because
  gating in a layout still runs the page and serializes its data into the RSC payload.
- **Writes keyed by wallet address require proof of that wallet.** An address is a public
  identifier, so anything that trusted one as an argument could be spoofed. Setting a username or
  leaving a review means signing a challenge transaction built with sequence 0 — unsubmittable by
  construction, since a valid sequence must be the account's current one plus one. Nonces are
  single-use, enforced by a primary key rather than by clearing a cookie.
- **Every SQL statement is parameterized**, in both the web app and the indexer.

### Known gaps before mainnet

| Gap | Why it matters |
|---|---|
| No external audit | The contracts have been reviewed only by their author |
| No timelock on `add_strategy` / `set_keeper` | A new venue or a rotated keeper lands instantly |
| Single admin key, not a multisig | One key is one point of failure |
| Shared admin password | Fine for one operator on testnet; not an accountable identity |
| Yield credited atomically at harvest | A deposit timed just before a harvest captures a share of yield it was not exposed to. Streaming it over the harvest interval is the fix |
| `claim_emissions` unreachable | BLND accrues with no way to collect it — yield left on the table, not a safety issue |

---

## Documentation

| Document | What's in it |
|---|---|
| [`NEBULA.md`](NEBULA.md) | Source of truth — mechanism design, yield sources, decisions, risks |
| [`docs/SUCCESS_METRICS.md`](docs/SUCCESS_METRICS.md) | Level 4 requirement tracker and build plan |
| [`docs/USER_SURVEY.md`](docs/USER_SURVEY.md) | The tester survey — every field, and why each one is there |
| [`evidence/README.md`](evidence/README.md) | The exported on-chain record: what is in it, how to check it, what it cannot show |
| [`docs/FRONTEND_PLAN.md`](docs/FRONTEND_PLAN.md) | Page inventory and the landing-page section breakdown |
| [`web/README.md`](web/README.md) | The interface — stack, design system, auth, environment |
| [`indexer/README.md`](indexer/README.md) | Event indexer — setup, commands, and the two RPC gotchas |

## Indexer

`indexer/` ingests vault events into Postgres and is what makes the dashboard and the usage
evidence possible:

```bash
cd indexer && npm install && cp .env.example .env
npm run migrate && npm run sync
npm run stats        # TVL, share price, depositor count, realized APY
npm run depositors   # every depositing address, with tx hashes
npm run export       # the whole record to evidence/*.csv
```

It runs every 10 minutes from GitHub Actions, which needs `DATABASE_URL` set as a repository secret.
That schedule matters more than it looks: Soroban RPC discards events after roughly a week, and a
gap cannot be backfilled once they are gone — so the record of who used the protocol has to be
captured as it happens. A run exits non-zero if it detects a retention gap or fails to store a row,
so an incomplete sync goes red rather than quietly reporting success.

Ingestion is idempotent on the RPC event id, so re-reading a range is harmless, and events are
accepted only from the configured vault contract — a filter enforced at the request *and* re-checked
on arrival, since the RPC applying it is not one we run.

> On hosted Postgres, use a **pooler** connection string rather than the direct host. Supabase's
> direct endpoint is IPv6-only and GitHub Actions runners are IPv4-only, so the direct URL cannot
> connect from CI at all.

---

## License

Apache-2.0
