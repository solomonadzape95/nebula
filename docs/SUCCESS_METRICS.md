# Nebula — Level 4 Success Metrics

**Level 4 focus:** Production-Ready MVP + Real Users + Product Validation
**Prize:** $100 per selected winner, monthly review period
**Status legend:** ⬜ Not started · 🟡 In progress · ✅ Done · 🔗 Evidence linked

> Companion to [`../NEBULA.md`](../NEBULA.md). That file says *what* Nebula is; this file tracks
> *whether it clears the bar*. Update the Status column as you go — this doubles as your
> submission-day checklist.

---

## 0. Scoreboard

*Last audited against the repository on 2026-08-14, at 69 commits.*

| Category | Requirements | Done |
|---|---|---|
| Production MVP | 4 | 3 / 4 |
| User Onboarding | 3 | 0 / 3 |
| Product Quality | 4 | 3 / 4 |
| Technical Standards | 3 | 3 / 3 |
| Demo & Review | 2 | 0 / 2 |
| **Submission checklist** | **11** | **5 / 11** |

### The one thing actually standing between here and a pass

**Nobody outside this project has used it.** Zero external users, zero survey responses. This is
the requirement that fails submissions, it cannot be backfilled in the final week, and every other
item is either done or is downstream of it — the funnel screenshot, the feedback summary and half
the demo video are all just renderings of user activity that has not happened.

Everything that could be closed without other people has been. Cleared on 2026-08-14:

- **The contracts were redeployed** on the post-security-pass build, so the vault on testnet now
  matches what the README describes, and the ≥2-week stability clock has started.
- **Error tracking shipped** — in PostHog rather than Sentry, deliberately; see 3.2.
- **The live URL is filled in** at [nebula.thesolenoid.space](https://nebula.thesolenoid.space),
  on a custom domain rather than `*.vercel.app`.
- **The evidence export was regenerated** against the new vault, so it no longer reports a retired
  contract's numbers as current traction.

---

## 1. Production MVP

| # | Requirement | Acceptance criteria — what "done" concretely means | Status | Evidence |
|---|---|---|---|---|
| 1.1 | Fully functional production-ready MVP | End-to-end on testnet: connect wallet → deposit XLM → receive nXLM → see share price → redeem XLM. Every step works on a clean browser with no console errors. | ✅ | Full cycle executed against the live Blend pool; signing round trip verified end to end. 20 routes building. |
| 1.2 | Stable frontend + contract architecture | Contracts deployed and stable for ≥2 weeks before submission with no redeploy. Frontend on a stable domain. Strategy trait implemented so adding a venue needs no vault change. | 🟡 | Redeployed 2026-08-14 on the post-security-pass build, so the **clock has started** — freeze the contracts from here. Frontend on a custom domain. The trait half is done: `Strategy` is implemented and a venue needs no vault change. |
| 1.3 | Mobile responsive UI | Every screen usable at 375px width. Wallet connect works in mobile browsers. No horizontal scroll anywhere. | 🟡 | Built responsive throughout; tab strips collapse behind a menu below `md`. Shader heroes now render as a frozen still below 768px and on touch devices — they were fragment-bound and janked the hero on a phone. Layout still unverified on a real iOS or Android device. |
| 1.4 | Loading states + error handling | Skeletons on every async read. Disabled+spinner on every tx button. Human-readable errors for: wallet rejected, insufficient balance, missing trustline, tx timeout, network down, contract error. **No raw error codes shown to users.** | ✅ | `VAULT_ERRORS` maps every contract code to a sentence in `lib/tx.ts`; `DataNotice` covers RPC and indexer outage; skeletons on async reads; tx buttons disable with a dithered spinner. |

**Error handling is the cheapest place to look production-grade.** Most submissions at this level
show a raw Soroban error string on failure. Map every error you can trigger to a plain sentence
plus a suggested fix. Reviewers notice immediately.

### Definition of Done for the MVP

- [ ] Deposit XLM → nXLM minted at correct share price
- [ ] Redeem nXLM → XLM returned including accrued yield
- [ ] Share price visibly increases after a harvest
- [ ] Blend strategy deposits, withdraws, and harvests
- [ ] Dashboard: your balance, your nXLM, current share price, your accrued yield, TVL
- [ ] Reserve buffer serves instant small redemptions
- [ ] Every failure path has a designed error state
- [ ] Works on iOS Safari and Android Chrome

---

## 2. User Onboarding

| # | Requirement | Acceptance criteria | Status | Evidence |
|---|---|---|---|---|
| 2.1 | Minimum 10 real users onboarded | ≥10 **distinct wallet addresses** that deposited. Aim for **20+** — some will be rejected as obviously self-generated. | ⬜ | **0.** The retired vault's 11 depositors were all self-generated and are not carried forward; the new vault has one address, the project's own test account. Every depositor from here is a genuine one, which is the point of having redeployed first. |
| 2.2 | Proof of wallet interactions | A table of address → tx hash → Stellar Expert link → action → timestamp. Plus a dashboard screenshot showing the count. Exportable as CSV. | 🟡 | Built, populated and exportable: `/asdfg/admin/users` lists every depositor with amount, first tx hash and a Stellar Expert link, and `npm run export` writes the same record to [`../evidence/`](../evidence/) as CSV with a per-row explorer URL. Waiting on real addresses to put in it. |
| 2.3 | Basic user feedback collection | ≥8 responses to a structured form + an in-app feedback widget. Summarized with actions taken. | 🟡 | **All three channels built.** In-app widget: floating button, 1–5 rating, free text, `actioned` column. Structured survey at `/feedback`: all 15 fields from [`USER_SURVEY.md`](USER_SURVEY.md), address taken from a signed session rather than typed, so every response joins to the on-chain record and the admin view reads "corroborated" off the chain. [Google Form](https://forms.gle/H1zS9wVeurADwuvt7) for reach, since the in-app form cannot hear from anyone who bounced before connecting. **0 responses — collection is built, recruitment has not started.** |

### Getting 10+ real users (the requirement most submissions fail)

Start this **three weeks before** the deadline, not three days. Testnet lowers the barrier to
near zero — nobody risks money — so lean on that hard.

| Channel | Approach | Realistic yield |
|---|---|---|
| Stellar Discord (#dev, #general) | Post a short demo clip + testnet link, ask for testers. Offer to test theirs back. | 5–15 |
| r/Stellar | "Built the first liquid yield vault on Stellar — testnet, would love feedback" | 3–10 |
| X / Twitter | Thread with a 30s screen recording. Tag @StellarOrg, @blend_capital, @aqua_token. | 2–8 |
| Your cohort | Direct asks. Reciprocate. | 5–10 |
| Stellar Dev Telegram | Short post with link | 2–5 |

**Remove every point of friction:**
- Link a testnet XLM faucet directly in the UI
- One-click Freighter → testnet network switch
- Pre-fill a suggested deposit amount
- Total time from landing to first deposit: **under 2 minutes**

**Log the proof as it happens** — build a `/admin/users` page backed by the indexer that lists
every depositor address, tx hash, amount, and timestamp. Screenshot it at submission time.

### Evidence table

Built and generated, not a template: `cd indexer && npm run export` writes
[`../evidence/`](../evidence/) — a row per wallet, a row per transaction, a row per harvest, each
with its own tx hash and Stellar Expert URL. Attach the CSVs and screenshot `/asdfg/admin/users`.

`depositors.csv` also carries `days_active`, which is the column a reviewer will read hardest — a
batch of wallets driven from one script in one sitting all read `1`. It is reported rather than
filtered, on the grounds that a file caught hiding one thing is not believed about anything.

### Feedback form

**Built and live at `/feedback`.** Full field spec, with the reasoning per field, in
[`USER_SURVEY.md`](USER_SURVEY.md). Fifteen fields,
under two minutes, and **field 1 is the wallet address** — which is what lets every response be
joined against `evidence/depositors.csv` and a claimed deposit that never happened be spotted.

The in-app widget is already shipped and is the other half: it catches people while they are annoyed,
where a form catches only those who come back. The requirement says collection is *mandatory*, and a
persistent in-app button is visible proof in a screenshot.

---

## 3. Product Quality

| # | Requirement | Acceptance criteria | Status | Evidence |
|---|---|---|---|---|
| 3.1 | Production deployment | Live on a real domain (Vercel + custom domain preferred over `*.vercel.app`). HTTPS. Uptime through the review window. | ✅ | [nebula.thesolenoid.space](https://nebula.thesolenoid.space) — Vercel on a custom domain, HTTPS. Database on Supabase, indexer on a GitHub Actions schedule. |
| 3.2 | Monitoring + analytics | Analytics **and** error monitoring, both live in production with real captured data. | 🟡 | **Both live in PostHog, and Sentry is deliberately not installed.** Funnel instrumented behind a typed event union, first-party `/ingest` proxy so blockers do not silently eat the data, drop-off panel in admin joining it to on-chain depositors. Errors captured on both sides — `capture_exceptions` in the browser, `onRequestError` on the server. One vendor means an `$exception` sits on the same timeline as the funnel that produced it; with two, "the funnel leaks at signing, what threw?" is a manual identity reconciliation across dashboards. Held at 🟡 only because "real captured data" still needs real traffic. |
| 3.3 | Optimized UX | Lighthouse ≥90 performance and ≥90 accessibility on mobile. First deposit in <2 min. No dead ends. | ⬜ | Not measured. Run Lighthouse against the deployed URL and record both numbers — this is a measurement task, not a build task. |
| 3.4 | Project structure + docs | Monorepo per NEBULA.md §8. README with setup, architecture, contract addresses. Inline docs on every public contract function. | ✅ | Root README covers setup, architecture, addresses, testing and security posture; `web/` and `indexer/` have their own. Every public contract function carries a doc comment explaining the reasoning, not just the signature. |

### Analytics events to instrument

Instrument these on day one — you can't retroactively generate a funnel screenshot.

**Shipped** (`lib/analytics.ts`, names are a compile-checked union so a typo cannot silently split
a funnel in two):

```
wallet_connect_started  { wallet }
wallet_connected        { wallet }
wallet_connect_failed   { wallet, reason }
deposit_submitted       { size }        ← size band, not an exact amount
deposit_confirmed       { size }
deposit_failed          { size, phase, reason }
withdraw_submitted      { size }
withdraw_confirmed      { size }
withdraw_failed         { size, phase, reason }
username_set
review_submitted        { rating }
```

Pageviews are captured automatically via `capture_pageview: "history_change"`, which follows
client-side navigation — the default listener would record one view per session and miss every page
after the first.

Two deliberate departures from the sketch above. **No wallet address and no exact amount:** the
privacy page promises analytics is not tied to your address, and an exact figure plus a timestamp
identifies one transaction on a public ledger, so amounts go as bands (`<10`, `10-100`, `100-1k`).
**`deposit_failed` carries the phase it died in** — `simulating`, `signing`, `submitting`,
`confirming`. Backing out at the wallet prompt and the contract rejecting you look identical in a
funnel and need opposite responses.

**The funnel screenshot that sells the submission:**
`page_view → wallet_connect → deposit_initiated → deposit_confirmed`, with drop-off percentages
at each step. That single image is proof of analytics *and* of product validation. It also tells
you where your onboarding actually leaks — fix the biggest drop before submitting.

### Error tracking

Shipped in PostHog, not Sentry — see 3.2 for the reasoning. Still worth doing before submission:

- Configure an alert rule on `$exception` volume. An alert that has actually fired proves a real
  setup rather than a switch someone flipped on the last day.
- Trigger one error deliberately on production and confirm it lands, so the screenshot for
  checklist item 8 has something in it.

---

## 4. Technical Standards

| # | Requirement | Acceptance criteria | Status | Evidence |
|---|---|---|---|---|
| 4.1 | Contracts on Stellar testnet | Vault, nXLM token, Blend strategy all deployed; IDs in the README; verified on Stellar Expert. Full deposit → allocate → harvest → redeem cycle executed against the live Blend pool. | ✅ | All three redeployed 2026-08-14 on the reviewed build, IDs in the README with Stellar Expert links, full cycle re-executed against the real pool via `scripts/smoke-test.sh` — see [`deployments/testnet.json`](../deployments/testnet.json). The sync decoded a `strategy_loss` event, one of the security fixes proving itself on-chain. |
| 4.2 | Minimum 15+ meaningful commits | Target **40+**. Each is a real, scoped change with a descriptive message. **No "wip", "fix", "update", or single mega-commit.** | ✅ | **69 commits**, every one Conventional Commits, zero `wip`/`update`/`fix stuff` subjects. Each carries the reasoning, so the log reads as a build history rather than a changelog. |
| 4.3 | Public GitHub repository | Public, with README, LICENSE, `.gitignore`, and no committed secrets. | ✅ | [`solomonadzape95/nebula`](https://github.com/solomonadzape95/nebula) — public, Apache-2.0, `.gitignore` in place. Scanned every commit in history for real keys and connection strings: none. Live credentials sit in `.env.local` and platform env vars, and `.env.example` is the only env file tracked. |

### Commit discipline

"Meaningful" is doing real work in that requirement — reviewers open the commit list and scan it.
A history that reads like a build log is itself evidence of engineering quality.

**Do:** `feat(vault): implement share price calculation with virtual offset`
**Don't:** `update`, `fix stuff`, `changes`

Use Conventional Commits. Suggested arc (~40 commits, naturally):

| Phase | Commits |
|---|---|
| Scaffold | Soroban workspace, Next.js app, CI, README |
| Token | SEP-41 nXLM, mint/burn auth, tests |
| Vault core | Deposit, redeem, share price, inflation-attack guard, tests |
| Strategy layer | Trait, registry, Blend adapter, harvest, tests |
| Deploy | Testnet scripts, contract IDs, seed data |
| Frontend | Wallet connect, dashboard, deposit, redeem, charts |
| Polish | Loading states, error mapping, mobile responsive, a11y |
| Observability | PostHog, Sentry, indexer, admin users page |
| Docs | README, architecture, security notes, screenshots |

**Warning:** don't fabricate history by splitting one session into 40 commits with backdated
timestamps. `git log` shows the pattern and it reads as gaming the metric. Just commit as you
work — 40 falls out naturally over three weeks.

---

## 5. Demo & Review

| # | Requirement | Acceptance criteria | Status | Evidence |
|---|---|---|---|---|
| 5.1 | Live demo video | 3–5 min, screen recording with voiceover, showing the complete flow end to end. Unlisted YouTube or Loom. | ⬜ | Record after the redeploy, so the contracts on screen are the ones described here. |
| 5.2 | Team review readiness | Prepared answers on technical complexity, product quality, architecture, real-world usefulness. | 🟡 | Most of the material now exists in writing — the README's Security section, the loss-recognition reasoning, and the Aquarius decision are all answers to likely questions. Still needs rehearsing rather than reading. |

### Demo video script (4 minutes)

| Time | Content |
|---|---|
| 0:00–0:30 | **Problem.** "XLM holders earn nothing. Yield on Stellar exists — Blend, Aquarius — but it's manual and fragmented." |
| 0:30–1:00 | **Solution.** Show the landing page. "Deposit XLM, get nXLM. It's worth more XLM every day. Fully liquid." |
| 1:00–2:00 | **Live flow.** Connect wallet → deposit → nXLM appears → dashboard updates. Real testnet tx, show the hash. |
| 2:00–2:45 | **Yield.** Show share price history chart. Trigger a harvest, show share price tick up. Show strategy allocation. |
| 2:45–3:15 | **Redeem.** nXLM → XLM with accrued yield. Show the delta explicitly. |
| 3:15–3:45 | **Under the hood.** Contract architecture diagram, strategy trait, Stellar Expert contract page. |
| 3:45–4:00 | **Traction.** Analytics funnel, user count, feedback highlights. Roadmap in one line. |

**Record the mobile view too** — 20 seconds of the phone flow, since mobile responsiveness is a
scored requirement and a screenshot proves less than motion.

### Review question prep

| Dimension | Have an answer ready for |
|---|---|
| Technical complexity | Share-price math, inflation-attack mitigation, strategy abstraction, i128 fixed-point handling |
| Product quality | Funnel data, feedback themes, what you changed because of feedback |
| Architecture | Why value-accruing over rebasing, why the strategy trait, upgrade/pause safety model |
| Real-world usefulness | The honest yield-source story — *and* why you corrected "staking" to "yield." Being the one team that got Stellar's consensus model right is a differentiator, not a weakness. |

---

## 6. Submission Checklist

| # | Item | Status | Link |
|---|---|---|---|
| 1 | Public GitHub repository | ✅ | [solomonadzape95/nebula](https://github.com/solomonadzape95/nebula) |
| 2 | README with complete documentation | ✅ | [`README.md`](../README.md) |
| 3 | 15+ meaningful commits (target 40+) | ✅ | 69, all Conventional Commits |
| 4 | Live demo link | ✅ | [nebula.thesolenoid.space](https://nebula.thesolenoid.space) |
| 5 | Contract deployment addresses | ✅ | [`deployments/testnet.json`](../deployments/testnet.json) + README table |
| 6 | Screenshot — product UI | ⬜ | |
| 7 | Screenshot — mobile responsive design | ⬜ | |
| 8 | Screenshot — analytics / monitoring setup | ⬜ | Setup is live; needs real traffic first, or the funnel is a row of zeros |
| 9 | Demo video link | ⬜ | |
| 10 | Proof of 10+ user wallet interactions | ⬜ | Page and CSV export built and working; **0 external addresses** |
| 11 | User feedback summary | ⬜ | Widget shipped, 0 responses |

### Screenshot shot list

Capture at 2x, crop tight, no browser chrome unless it adds context.

1. **Dashboard, desktop** — populated with real TVL, share price, and a user position
2. **Deposit flow** — modal open, amount entered, estimated nXLM shown
3. **Share price chart** — visible upward trend over time
4. **Mobile, 375px** — dashboard + deposit flow, side by side in one image
5. **PostHog funnel** — with drop-off percentages
6. **Sentry dashboard** — showing captured events and a configured alert
7. **Stellar Expert** — deployed contract page
8. **Admin users page** — the depositor list, addresses partially masked

### README structure

```markdown
# Nebula — Liquid Yield for XLM
[demo] [video] [testnet]

## What it is                  (2 sentences + screenshot)
## The problem                 (why XLM is dead capital)
## How it works                (diagram + share price explanation)
## Yield sources               (Blend, Aquarius — with the honest note on Stellar staking)
## Architecture                (contracts, frontend, indexer)
## Contract addresses          (testnet, with Stellar Expert links)
## Getting started             (prerequisites, install, build, deploy, run)
## Testing
## Analytics & monitoring
## Traction                    (users, TVL, feedback)
## Roadmap
## License
```

---

## 7. Six-week plan

| Week | Focus | Exit condition |
|---|---|---|
| 1 | Contracts: nXLM token + vault core (deposit/redeem/share price) with tests | Vault math correct, inflation attack covered by a test |
| 2 | Strategy layer + Blend adapter + testnet deploy | Full cycle works on testnet via CLI |
| 3 | Frontend: wallet connect, dashboard, deposit, redeem | Clickable end-to-end for one wallet |
| 4 | Polish: loading, errors, mobile, a11y. PostHog + Sentry + indexer. **Start user recruitment.** | Production deploy live, analytics capturing, first 3 external users |
| 5 | User push. Feedback collection. Fix what feedback surfaces. | 10+ distinct depositor wallets, 8+ feedback responses |
| 6 | Demo video, screenshots, README, submission assembly | All 11 checklist items ✅ |

**Weeks 4–5 are where submissions die.** Building is the fun part and it expands to fill the
time; recruitment gets three panicked days at the end and yields four users. Hard-stop feature
work at the end of week 4 and treat user acquisition as the deliverable it is.

### Where this actually is

**Weeks 1–4 are done.** Contracts, strategy layer, testnet deploy, the full frontend, polish, the
indexer, analytics and error tracking are all shipped, the redeploy owed from the security pass has
landed, and the app is live on a custom domain. Week 4's exit condition is met apart from its last
clause: *first 3 external users.*

**The week-5 work has not started, and it is the work that decides this.** Zero external users, zero
feedback responses. Everything built is only worth what someone else's hands make of it. The ordered
path from here, and note that the first four items are all the same item:

1. ~~Build the survey~~ — done, at `/feedback`.
2. **Recruit.** Stellar Discord, r/Stellar, the cohort, Telegram. Target 20 so 10 survive scrutiny.
3. **Send people to `/feedback`** right after they deposit, while the wallet is still open — and
   put the [Google Form](https://forms.gle/H1zS9wVeurADwuvt7) in every recruiting post, so the ones
   who never connect still land somewhere.
4. **Act on what comes back**, and record what changed. *"n responses, m corroborated on-chain, k
   changes shipped as a result"* is worth more to a reviewer than any average rating.
5. Screenshots and the demo video last, once the funnel has real numbers in it.

**Freeze the contracts from here.** The stability clock started 2026-08-14 and another redeploy
resets both it and the event history.

---

## 8. Risk register for the submission itself

| Risk | Impact | Mitigation |
|---|---|---|
| Fewer than 10 users | **Instant fail** | Start week 4. Target 20. Reciprocal testing within your cohort. |
| Reviewer challenges the yield model | Credibility | You already corrected it. Lead with it — cite Protocol 12. |
| Contract bug during demo period | Broken live demo | Freeze contracts after week 3. Deposit caps. Testnet only. |
| Analytics installed too late | Empty funnel screenshot | Instrument in week 4, before user recruitment starts. |
| Commits look padded | Quality score | Commit as you work, over weeks. Conventional Commits. |
| Blend testnet unavailable | Strategy can't demo | Build a mock strategy behind the same trait as a fallback. The abstraction pays for itself here. |
