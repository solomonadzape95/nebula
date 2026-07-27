# Nebula — Frontend Plan

Page inventory and landing-page breakdown. Companion to [`NEBULA.md`](../NEBULA.md) (what Nebula
is) and [`SUCCESS_METRICS.md`](SUCCESS_METRICS.md) (what the submission must clear).

**Stack:** Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Stellar Wallets Kit ·
PostHog (analytics) · Sentry (error tracking)

---

## 0. The two data sources

Every page reads from one of two places. Knowing which one saves a lot of confusion later.

| Source | Answers | Used for |
|---|---|---|
| **Contracts** (live, via RPC) | "What is true *right now*?" — your balance, share price, TVL | Anything the user is about to act on |
| **Indexer** (Postgres) | "What *happened*?" — history, charts, APY, who used it | Anything with a time axis or an aggregate |

Rule of thumb: **if a wrong number would cost the user money, read the contract.** Never quote a
balance or price from the database when someone is about to press Deposit.

---

## 1. Page inventory

### Public — no wallet required

| Route | Purpose | Priority |
|---|---|---|
| `/` | Landing. Explain, prove, convert. | **P0** |
| `/how-it-works` | Plain-language explainer: nXLM, share price, where yield comes from | **P1** |
| `/stats` | Public transparency dashboard — TVL, share price chart, strategy allocation | **P1** |
| `/faq` | Short answers to the recurring questions | P2 |
| `/terms`, `/privacy` | Boilerplate | P3 |

### App — wallet connected

| Route | Purpose | Priority |
|---|---|---|
| `/app` | **The product.** Your position + deposit/withdraw in one screen. | **P0** |
| `/app/activity` | Your own deposit/withdraw history with links to Stellar Expert | **P1** |
| `/app/vault` | Where your money actually is — strategies, reserve, caps | P2 |

### Admin — restricted

| Route | Purpose | Priority |
|---|---|---|
| `/admin/users` | Depositor table with tx hashes — **Level 4 proof-of-users evidence** | **P0** |
| `/admin/ops` | Keeper/admin controls: allocate, harvest, pause, strategy weights | P2 |

`/admin/users` is P0 not because users need it, but because the submission does. It's the
screenshot that proves 10+ real wallets interacted. Build it early — it's mostly a table over a
query the indexer already has.

For MVP, gate `/admin` by checking the connected wallet against the vault's `admin` address read
from the contract. Don't build a login system.

---

## 2. Deliberate omissions

**No separate `/deposit` and `/withdraw` pages.** They live as two tabs in one card on `/app`.
Every extra route is another click between a stranger and their first transaction, and the target
is under two minutes from landing to deposit. Lido, Yearn, and Blend all do it this way.

**No `/portfolio` or multi-vault pages.** There is one vault. Inventing navigation for a future
that may not arrive is how a two-page app becomes a nine-page app nobody finishes.

**No blog, no docs site.** `/how-it-works` and the GitHub README cover it.

---

## 3. The one fork worth deciding now

**Where does the deposit widget live?**

- **Option A — marketing landing at `/`, app at `/app`.** *(Recommended.)* Reviewers grade
  "product presentation," and a landing page that explains the product does that job. One
  prominent CTA carries people to `/app`.
- **Option B — app-first at `/`,** with marketing below the fold. Fewer clicks to a deposit, but
  a visitor who doesn't yet know what nXLM is gets a form instead of an answer.

Recommendation is A, with live numbers in the hero so `/` still feels alive rather than
brochure-ish. If onboarding stalls, moving the widget up is a small change.

---

## 4. Landing page — section by section

Ordered top to bottom. Each section has one job.

### 1. Nav
Logo · How it works · Stats · GitHub · **Connect / Launch App** (primary button, right side)

Keep it to four items. Sticky on scroll.

---

### 2. Hero — *"what is this and why should I care"*

- **Headline:** the promise in one line. Working draft:
  *"Earn on your XLM without locking it up."*
- **Subhead:** the mechanism in one sentence.
  *"Deposit XLM, get nXLM. It's worth more XLM every day, and you can trade or spend it any time."*
- **Primary CTA:** `Launch App` · **Secondary:** `How it works`
- **Live proof strip** — real numbers pulled from the indexer, not placeholders:
  `TVL · Current share price · Depositors · Live on testnet` badge

The live numbers matter more than they look. A landing page with a moving share price reads as a
working product; the same page with "$0.00" or hardcoded figures reads as a mockup.

**Visual idea:** a share-price line that only goes up, rendered subtly behind or beside the copy.
It's the whole product in one image.

---

### 3. The problem — *"why you need this"*

Three short beats, or one paragraph with emphasis:

> Your XLM sits in a wallet earning nothing. Real yield exists on Stellar — but claiming it means
> managing lending positions by hand, harvesting rewards, and re-depositing. Most people never do.
> And the moment your XLM is in a lending pool, it stops being spendable.

Keep it to ~40 words. Do not stack five pain points.

---

### 4. How it works — *the three steps*

Three cards or a horizontal stepper:

| | |
|---|---|
| **1. Deposit XLM** | You receive nXLM. This is your receipt. |
| **2. It goes to work** | Nebula supplies it to Blend's lending market. Borrowers pay interest. |
| **3. Redeem any time** | Your nXLM is worth more XLM than when you got it. |

Optionally a fourth beat: *"Or don't redeem — trade or spend nXLM directly. It keeps earning until
you do."*

---

### 5. The nXLM explainer — *the concept everything hangs on*

This section earns its place. It's the thing people don't get.

**Use the gold framing:**

> **Think of it like gold.** You own 10 grams. A year later you still own 10 grams — the number
> never changes. It's just worth more.
>
> nXLM works the same way. Your balance is fixed the moment you receive it. What rises is the
> price.

**Visual idea — a small before/after table**, ideally animated or with a time slider:

| | At deposit | Today |
|---|---|---|
| Your nXLM | 100.00 | **100.00** |
| Price per nXLM | 1.0000 XLM | **1.0142 XLM** |
| Worth | 100.00 XLM | **101.42 XLM** |

Bold the row that *doesn't* change. That's the point.

---

### 6. Where the yield comes from — *the trust section*

Be specific and be honest. This is where a knowledgeable reviewer decides whether to believe you.

- Yield is **borrower interest from Blend**, a lending market on Stellar. Real people borrowing,
  really paying interest.
- **Not** token emissions, not inflation, not a subsidy.
- Link the Blend pool on Stellar Expert so it's checkable.
- Say plainly: **Stellar has no protocol staking.** SCP is not proof-of-stake, and inflation was
  disabled in 2019. Nebula is a yield vault, not a staking protocol.

That last bullet is a differentiator, not a disclaimer. Most people pitching "XLM staking" have it
wrong; being the project that says so out loud signals you actually understand the chain.

---

### 7. Live performance — *proof*

- Share price chart over time (from the indexer)
- Realized APY, with the window stated: *"4.2% — measured over the last 14 days"*
- TVL over time

**Show nothing rather than something fake.** The indexer deliberately returns `null` for APY under
six hours of history, because annualizing a few minutes produces numbers in the thousands of
percent. Render "Not enough history yet" in that case. A reviewer who spots an implausible APY
stops trusting every other number on the page.

---

### 8. Security & trust

Short, scannable, specific. Vague reassurance is worse than none.

- **Redemptions can never be paused.** Deposits can be halted; getting your money out cannot.
- **Nobody can mint nXLM but the vault.** The minter is fixed at deployment and cannot be changed.
- **Admin can't touch user funds.** It can register strategies and set parameters — that's all.
- **The keeper can't steal.** It only moves money between the vault and registered strategies.
- **One invariant, always true:** every XLM is either in the reserve or in a strategy.
- **Open source** — link the repo. **Testnet only** — say so clearly.

---

### 9. FAQ

Five or six, in an accordion:

- What is nXLM?
- Where does the yield actually come from?
- Can I lose money?
- What are the fees? *(10% of yield earned — never of your deposit)*
- How fast can I withdraw?
- Is this staking? *(No — and here's why)*

---

### 10. Final CTA
Repeat the headline promise, one button, live TVL beside it.

---

### 11. Footer
GitHub · Contract addresses (linked to Stellar Expert) · Blend · Stellar · Feedback form ·
"Testnet — tokens have no real value"

---

## 5. Inspiration to look at

| Site | Steal |
|---|---|
| **lido.fi** | Hero with live stats; the cleanest liquid-token explanation on the internet |
| **rocketpool.net** | rETH is value-accruing like nXLM — read how they explain "your balance doesn't change" |
| **yearn.fi** | Vault card layout; deposit/withdraw as tabs in one card |
| **blend.capital** | Your actual yield source; also the right visual register for Stellar DeFi |
| **jito.network** | Stats-forward hero, strong trust section |
| **aave.com** | Best-in-class numeric typography and data density |
| **app.aquarius.finance** | Stellar-native design language |
| **originprotocol.com/oeth** | Auto-compounding vault positioned for non-crypto-native users |

For the *shape* of a good landing page more generally: **linear.app**, **vercel.com**,
**stripe.com**. Not DeFi, but the sectioning and rhythm are worth studying.

---

## 6. Shared components

Build these once:

- `<ConnectWallet />` — Stellar Wallets Kit, one integration covers Freighter, xBull, Albedo,
  Lobstr, Rabet, Hana
- `<StatCard />` — label, big number, sublabel
- `<SharePriceChart />` — Recharts line
- `<AmountInput />` — with MAX button and balance display
- `<TxButton />` — idle → simulating → awaiting signature → submitting → confirmed, all states
- `<ErrorMessage />` — maps contract errors to plain sentences
- `<AddressLink />` — truncated address linked to Stellar Expert
- `<FeedbackWidget />` — persistent, submission requires it

### Error mapping is not optional

The contracts return numbered errors. Users must never see one. Map every reachable code to a
sentence and a suggested fix:

| Contract error | What the user sees |
|---|---|
| `DepositTooSmall` | "That's too small to mint a share. Try at least X XLM." |
| `CapExceeded` | "The vault is at capacity during beta. Try a smaller amount." |
| `DepositsPaused` | "Deposits are paused right now. Withdrawals are unaffected." |
| `InsufficientLiquidity` | "Not enough is liquid right now. Try a smaller amount." |
| Wallet rejected | "You cancelled the transaction." |
| Insufficient XLM | "You don't have enough XLM. You need X, you have Y." |

This is the cheapest place to look production-grade, and most submissions skip it.

---

## 7. Build order

**Milestone 1 — it works**
`/app` with connect, deposit, withdraw, live position. Nothing else. Deployed and reachable.

**Milestone 2 — it's provable**
`/admin/users`, indexer wired to a hosted database, PostHog + Sentry, feedback widget.
*This unblocks user recruitment — do it before writing marketing copy.*

**Milestone 3 — it's presentable**
`/` landing, `/how-it-works`, `/stats`, mobile polish, all error states.

**Milestone 4 — nice to have**
`/app/activity`, `/app/vault`, `/admin/ops`, `/faq`.

The instinct is to build the landing page first because it's the fun part. Resist it: the landing
page converts nobody until there's an app behind it, and the 10-user requirement is the one thing
that can't be rescued in the final week.

---

## 8. Level 4 requirement mapping

| Requirement | Where it's satisfied |
|---|---|
| Mobile responsive UI | Every page — 375px is the test width |
| Loading states + error handling | `<TxButton />`, `<ErrorMessage />`, skeletons on every async read |
| 10+ real users | `/app` onboarding + `/admin/users` as evidence |
| Feedback collection | `<FeedbackWidget />` + linked form |
| Analytics/monitoring | PostHog funnel + Sentry, instrumented from Milestone 2 |
| Production deployment | Vercel, custom domain preferred |
| Screenshots | `/app` desktop, `/app` at 375px, PostHog funnel, `/admin/users` |
| Demo video | Follows `scripts/smoke-test.sh` — same journey, in a browser |
