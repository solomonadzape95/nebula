# Nebula — Source of Truth

**Liquid yield for XLM.** Deposit XLM, receive `nXLM`, keep full liquidity while the protocol
earns yield on your behalf.

> This document is the single source of truth for Nebula. Product decisions, mechanism design,
> and terminology live here. If a pitch deck, README, or submission form contradicts this file,
> this file is right and the other thing needs updating.

---

## 0. Read this first — the correction that shaped the design

The original concept was "liquid staking for XLM," modelled on Lido (Ethereum) and Jito (Solana).
**That mechanism does not exist on Stellar.**

| Assumption | Reality |
|---|---|
| Validators stake XLM in SCP | SCP is Federated Byzantine Agreement, **not** proof-of-stake. Validators bond nothing. |
| Validators earn staking rewards | Validators earn **zero** protocol rewards. Running a node is a net cost. |
| XLM inflation funds yield | Inflation was **disabled in Protocol 12** on 2019-10-28. The `inflation` operation is deprecated. |
| Validators can be slashed | There is no slashing. No bond exists to slash. |
| "Base reserve" is a stake | Base reserve (0.5 XLM/entry) is an anti-spam ledger deposit, not a stake. |

Binance killed its XLM staking product in 2019 for exactly this reason.

**Why the product still works.** The user problem was never "I want validator rewards." It was
*"my XLM sits idle and earning yield means selling it or babysitting positions."* That problem is
real, and Stellar now has genuine yield sources — they're just fragmented, manual, and require
active management. Nebula wraps them in one liquid, composable token.

**What changed in the design:**

- "Validator Registry" → **Strategy Registry** (yield venues, not validators)
- "Slashing insurance pool" → **Loss reserve** (bad debt, impermanent loss, depeg)
- "SCP delegation" → **Strategy allocation** across Blend / Aquarius / SDEX

Everything else — `nXLM`, share-price accrual, SDEX tradability, path payments, mobile app,
DeFi composability — carries over unchanged.

**Do not use the words "staking," "validator rewards," or "slashing" in the submission.**
Use "yield," "strategies," and "loss reserve."

---

## 1. One-liner & positioning

**Nebula is the yield-bearing XLM standard.**

Hold `nXLM` instead of XLM. It is worth strictly more XLM every day. It trades on SDEX, moves
through path payments, and plugs into Soroban lending markets as collateral. You never manage a
position, claim a reward, or compound anything.

**Elevator pitch (30s):**
> Stellar has real DeFi yield — Blend lending markets, Aquarius liquidity incentives — but using
> it means manually supplying to pools, claiming AQUA emissions, swapping them, and re-depositing.
> Most XLM holders don't. Nebula does it for them: deposit XLM, get nXLM, and the token quietly
> appreciates. It's Yearn's auto-compounding vault and Lido's liquid receipt token, built for
> Stellar's cent-fraction fees where compounding actually pays.

---

## 2. The problem

1. **XLM is dead capital.** The majority of XLM sits in wallets and exchange accounts earning
   nothing. There is no protocol-level yield to fall back on.
2. **Yield exists but is fragmented.** Blend has lending markets. Aquarius pays AQUA emissions
   to AMM and SDEX liquidity. Soroswap has pools. Each requires a separate UI, a separate
   position, separate claiming.
3. **Compounding is manual.** AQUA emissions must be claimed and swapped by hand. Most users
   never do it, so their real yield is far below headline APY.
4. **Yield positions aren't liquid.** LP shares and Blend supply positions can't be spent,
   traded on SDEX, or used as collateral elsewhere without unwinding.
5. **Value leaks off-chain.** Holders wanting yield sell XLM for assets on other chains.

**Nebula collapses all five into one token.**

---

## 3. Why Stellar (defensible, not decorative)

| Stellar capability | How Nebula depends on it |
|---|---|
| **Fees ~0.00001 XLM** | Auto-compounding is only profitable if harvest cost ≪ harvest yield. On Ethereum, compounding small positions is uneconomic; on Stellar it's free. **This is the core moat.** |
| **SDEX + native AMM** | `nXLM`/XLM secondary market with zero external DEX integration. Instant exit without touching the vault. |
| **Path payments** | Spend `nXLM`, recipient receives USDC. Yield-bearing money that is still money. |
| **Stellar Asset Contract (SAC)** | `nXLM` is simultaneously a classic Stellar asset (wallets, SDEX, trustlines) and a Soroban token. No wrapper. |
| **~5s finality** | Deposit and redeem feel synchronous. |
| **Anchor network** | Roadmap: redeem `nXLM` straight to local fiat via anchors — no other chain has regulated fiat rails as a primitive. |

The honest one-line version: **Stellar is the only chain where auto-compounding a small position
is economically rational, and where the receipt token is natively liquid and spendable on day one.**

---

## 4. Target users

| Segment | Job to be done | Why Nebula |
|---|---|---|
| Retail XLM holders | "Earn something without selling or learning DeFi" | One button. No position management. |
| Stellar DeFi users | "Stop manually claiming AQUA" | Auto-compounded, gas-free harvesting. |
| Payment apps / anchors | "Idle float earns nothing" | Hold treasury float in `nXLM`, still spendable via path payments. |
| Soroban protocols | "Need a yield-bearing collateral asset" | `nXLM` as productive collateral. |
| Institutions / treasuries | "Yield with an audit trail" | Transparent on-chain strategy allocation. |

**For Level 4, the beachhead is retail XLM holders in the Stellar community** (Discord, Reddit,
X). They're reachable, they hold XLM, and they'll test on testnet for the novelty.

---

## 5. How it works

### 5.1 User flow

```
    Deposit XLM ──▶ Vault mints nXLM at current share price
                          │
                          ▼
              Vault allocates across strategies
              ┌───────────┼────────────┐
              ▼           ▼            ▼
          Blend       Aquarius      Reserve
        (lending)   (AMM + AQUA)   (instant-exit buffer)
              │           │            │
              └───────────┼────────────┘
                          ▼
            Harvest: claim AQUA + interest,
            swap to XLM via Soroswap/SDEX,
            redeposit → total assets ↑
                          │
                          ▼
              Share price ↑  (nXLM worth more XLM)
                          │
        ┌─────────────────┼──────────────────┐
        ▼                 ▼                  ▼
   Hold & accrue    Trade on SDEX      Redeem for XLM
                    / path payment      (+ accrued yield)
```

### 5.2 Token mechanics — value-accruing, not rebasing

`nXLM` supply never changes on its own. Its **redemption value** rises.

```
share_price = total_assets / total_supply          (XLM per nXLM)

mint:    shares_out = xlm_in  * total_supply / total_assets
redeem:  xlm_out    = shares_in * total_assets / total_supply
```

First deposit into an empty vault sets `share_price = 1.0`.

**Why value-accruing over rebasing:** rebasing tokens break naive integrations — AMM pools,
lending collateral, and accounting all mis-handle a balance that changes without a transfer.
This is why Rocket Pool's rETH and Coinbase's cbETH won over rebasing designs. `nXLM` behaves
like an ordinary token, so every Soroban protocol can integrate it without special-casing.

### 5.3 Critical implementation details

**Inflation attack (first-depositor attack).** The classic ERC-4626 vulnerability: an attacker
deposits 1 stroop, receives 1 share, then donates a large amount of XLM directly to the vault.
Share price becomes enormous, and the next depositor's shares round down to zero — their deposit
is stolen.

Mitigations, both of which Nebula implements:
1. **Dead shares** — mint a small share amount to the zero address on first deposit so supply
   can never approach 1.
2. **Virtual offset** — compute share price as `(total_assets + 1) / (total_supply + 10^n)`.

**Never derive `total_assets` from a live balance query.** Track it in contract state, updated
only by deposit, redeem, and harvest. A donation-driven balance read is the attack surface above.

**Rounding always favours the vault.** Mint rounds down, redeem rounds down. An off-by-one that
favours the user is drainable in a loop.

**Integer math only.** i128 with fixed-point scaling (7 decimals, matching XLM's stroop).
No floats anywhere.

### 5.4 Instant exit vs. queued exit

Some strategy positions can't unwind atomically. Two exit paths:

- **Instant** — served from the reserve buffer (target ~10% of TVL) or by selling `nXLM` on SDEX.
- **Queued** — large redemptions enter a withdrawal queue, filled as strategies unwind.

The SDEX market is the pressure valve: a user who doesn't want to wait sells `nXLM` at a small
discount. This is exactly how stETH handled exit-queue pressure before Ethereum withdrawals
existed.

---

## 6. Yield sources

| Source | Mechanism | Notes |
|---|---|---|
| **Blend** | Supply XLM to lending pools, earn borrower interest | Isolated-pool lending on Soroban. Utilization-driven; verify live rates before quoting any APY. |
| **Aquarius (AQUA)** | Emissions to AMM + SDEX liquidity providers | Aquarius distributes AQUA daily across pools. Emissions are the dominant yield component today. |
| **AMM trading fees** | Fees from Stellar native AMM / Soroswap pools | Comes with impermanent loss exposure — size accordingly. |
| **ICE boost** | Locking AQUA mints ICE, boosting LP rewards | Meaningful multiplier. Treasury-level optimization; **v2, not MVP.** |

**Do not put a headline APY in the submission unless you measured it that week.** Yield on
Stellar is emissions-driven and moves fast. Quote *observed* vault performance from your own
testnet/mainnet data, or quote nothing. A wrong APY number is the fastest way to lose reviewer
trust.

**MVP scope:** Blend supply strategy only. It is the simplest to reason about, has no
impermanent loss, and unwinds cleanly. Aquarius comes in v1.1 once the vault accounting is proven.

**Implementation note — where the yield actually comes from.** The Blend adapter harvests *interest*,
not emissions. Interest accrues in XLM itself (the bToken rate rises), so it can be realized with
no swap and credited straight to the share price. BLND emissions are a separate asset and need a
DEX route to become XLM; until that route exists they are claimed to the treasury and deliberately
excluded from the share price. Counting an asset the vault cannot redeem into would inflate the
price against XLM the vault does not hold — the same class of mistake as trusting a strategy's
self-reported gain.

This matters for the APY story: **the honest MVP number is the lending rate alone.** Emissions are
usually the larger component on Stellar today, so quoting a combined figure before the swap route
ships would overstate what a depositor actually earns.

---

## 7. Architecture

### 7.1 Contracts (Soroban / Rust)

```
contracts/
├── interfaces/       # Strategy + ShareToken traits. The seam between vault and venues.
├── vault/            # Core. Deposits, redemptions, share price, allocation, harvest,
│                     # and the strategy registry.
├── nxlm-token/       # SEP-41 token. Minter fixed to the vault at construction.
└── strategies/
    ├── mock/         # Controllable test double; also the Blend-unavailable fallback.
    ├── blend/        # (v1.0) Supply/withdraw XLM to a Blend pool
    └── aquarius/     # (v1.1) LP + AQUA claim + swap-to-XLM
```

**The registry lives inside the vault, not in its own contract.** The original plan split it out.
Implementation made the cost obvious: the vault is the registry's only consumer, so separating it
adds a cross-contract call to every deposit and harvest plus a second upgrade boundary to audit,
in exchange for no capability the admin does not already have. Split it out later if a second
consumer appears; not before.

**The loss reserve is deferred to v1.1.** The protocol fee is implemented and routed to a
configurable recipient, which is the mechanism the reserve needs; the reserve contract itself is
not on the MVP critical path and would be untested surface area during the review window.

**Strategy interface** — every strategy implements the same trait, so the vault never
special-cases a venue:

```rust
pub trait Strategy {
    fn deposit(env: Env, amount: i128);
    fn withdraw(env: Env, amount: i128) -> i128;   // returns actual XLM returned
    fn harvest(env: Env) -> i128;                  // claim + swap, returns XLM gained
    fn total_assets(env: Env) -> i128;             // strategy's XLM-denominated value
    fn max_withdrawable(env: Env) -> i128;         // liquidity available right now
}
```

This trait is the single most important design decision in the codebase. Get it right and adding
a venue is one new contract; get it wrong and every integration touches the vault.

### 7.2 Access control & safety

| Control | Purpose |
|---|---|
| Admin (multisig) | Register/remove strategies, set weights, set fee |
| Keeper role | Call `harvest()` — permissionless-with-incentive later |
| Pause switch | Halt deposits; **redemptions must never be pausable** |
| Per-strategy cap | Bounds blast radius of any single venue failing |
| Timelock on upgrades | Non-negotiable before mainnet. Not required for testnet MVP. |

### 7.3 Frontend

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Server components for read-heavy dashboard; Vercel deploy |
| Styling | Tailwind + shadcn/ui | Fast, accessible, mobile-responsive by default |
| Stellar SDK | `@stellar/stellar-sdk` | Contract invocation + Horizon queries |
| Wallets | Stellar Wallets Kit | One integration → Freighter, xBull, Albedo, Lobstr, Rabet, Hana |
| Charts | Recharts | Share price / TVL history |
| Analytics | PostHog (product) + Sentry (errors) | **Both required for Level 4** |

### 7.4 Indexer

The vault emits events on every deposit, redeem, and harvest. A small indexer ingests them into
Postgres and serves:

- TVL over time
- Share price history → realized APY
- Unique depositor count ← **this is your Level 4 proof-of-users evidence**
- Per-strategy allocation

Build this early. It's how you generate the analytics screenshots and the "10+ wallet
interactions" proof without scrambling at the deadline.

---

## 8. Repository layout

```
nebula/
├── NEBULA.md                    ← this file
├── README.md                    ← public-facing, required for submission
├── Cargo.toml                   ← Soroban workspace root
├── docs/
│   └── SUCCESS_METRICS.md       ← Level 4 requirement tracker
├── contracts/                   ← Soroban contracts (Rust)
├── scripts/
│   ├── deploy.sh                ← salted paired deploy of vault + share token
│   └── keeper.sh                ← allocate + harvest loop
├── web/                         ← Next.js frontend (not yet started)
└── indexer/                     ← event indexer + API (not yet started)
```

### Deploying the vault/token pair

The share token fixes its minter at construction and the vault rejects a share token that does not
name it, which makes the two mutually dependent. `scripts/deploy.sh` breaks the cycle with a salted
deploy: a contract's address is derived from `(source account, salt)`, so the vault's address can
be computed *before* the vault exists.

1. compute the vault's future address from a salt
2. deploy the token naming that address as minter
3. deploy the vault to that exact address, naming the token

Step 3 verifies the binding on-chain, so a deploy-order mistake fails the deployment rather than
producing a live vault that can never mint.

---

## 9. Terminology (use these exact words)

| Term | Meaning |
|---|---|
| **Vault** | The core contract holding XLM and issuing nXLM |
| **nXLM** | Value-accruing receipt token |
| **Share price** | XLM per nXLM. Monotonically non-decreasing except on loss. |
| **Strategy** | A yield venue adapter (Blend, Aquarius) |
| **Harvest** | Claim rewards → swap to XLM → add to total assets |
| **Reserve buffer** | Idle XLM held for instant redemptions |
| **Loss reserve** | Protocol-fee-funded buffer against strategy losses |

**Banned words:** staking, validator, slashing, delegation, epoch. They describe mechanisms
Stellar does not have.

---

## 10. Open decisions

| # | Decision | Leaning | Resolve by |
|---|---|---|---|
| 1 | Protocol fee on yield | 10% of harvest → loss reserve + treasury | Before mainnet |
| 2 | Deposit cap during beta | Yes — caps blast radius, creates scarcity | MVP |
| 3 | Governance token | **No.** Ship the vault. A token before product-market fit is a distraction. | Post-Level-4 |
| 4 | Keeper incentive | Start admin-only cron; make permissionless + fee-paid in v1.1 | v1.1 |
| 5 | Mobile: PWA or native | **PWA.** "Mobile responsive" is the requirement; native is scope creep. | MVP |
| 6 | Multi-asset vaults (nUSDC) | After nXLM proves out | v2 |

---

## 11. Risks to state honestly in the submission

Reviewers trust builders who name their own risks.

1. **Yield is emissions-dependent.** AQUA emissions can change. Mitigation: multi-strategy design;
   the vault survives any single venue going to zero yield.
2. **Smart contract risk.** Mitigation: minimal MVP surface, deposit caps, testnet-only for
   Level 4, audit before mainnet.
3. **Strategy counterparty risk.** Blend or Aquarius could have a bug. Mitigation: per-strategy
   caps, loss reserve, pause switch.
4. **Liquidity risk.** Thin nXLM/XLM SDEX book means wide exit spreads. Mitigation: reserve
   buffer + protocol-seeded liquidity.
5. **Regulatory.** Yield products draw scrutiny in some jurisdictions. Mitigation: non-custodial,
   no promised returns, transparent on-chain accounting.

---

## 12. Resources

**Stellar & Soroban**
- Developer docs — https://developers.stellar.org
- Soroban smart contracts — https://developers.stellar.org/docs/build/smart-contracts
- SEP-41 token interface — https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md
- Stellar Asset Contract — https://developers.stellar.org/docs/tokens/stellar-asset-contract
- Path payments — https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations
- Liquidity pools / AMM — https://developers.stellar.org/docs/learn/encyclopedia/sdex/liquidity-on-stellar-sdex-liquidity-pools
- Stellar Wallets Kit — https://stellarwalletskit.dev
- Stellar Community Fund — https://communityfund.stellar.org

**Yield venues**
- Blend — https://www.blend.capital · docs https://docs.blend.capital
- Aquarius — https://aqua.network
- Soroswap — https://soroswap.finance
- DefiLlama (Stellar TVL, live) — https://defillama.com/chain/Stellar

**Reference implementations to study**
- ERC-4626 tokenized vault standard — the share-price math and its known attacks
- Yearn v3 vaults — strategy abstraction and harvest patterns
- Rocket Pool rETH — value-accruing receipt token design

**Why Stellar has no staking (cite if challenged)**
- Protocol 12 disabled inflation — https://coincodex.com/article/5747/stellar-disables-inflation-mechanism-with-v12-protocol-upgrade
- Binance ended XLM staking as a result — https://u.today/stellar-staking-terminated-by-binance-as-xlm-inflation-disabled

---

## 13. Changelog

| Date | Change |
|---|---|
| 2026-07-27 | Initial source of truth. Pivoted from "liquid staking" to "liquid yield vault" after confirming SCP has no economic staking and inflation was disabled in Protocol 12. |
