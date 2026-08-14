# User survey — field spec

The structured half of requirement 2.3 in [`SUCCESS_METRICS.md`](SUCCESS_METRICS.md): **≥8 responses
to a form, summarized with the actions taken.**

**Built, two ways.** This document is the spec both implement:

| | Where | Trade |
|---|---|---|
| In-app | [`/feedback`](https://nebula.thesolenoid.space/feedback) | Address comes from a signed wallet session, so every response joins to the chain automatically and nothing is typed. Only reaches people who connected. |
| Google Form | [forms.gle/H1zS9wVeurADwuvt7](https://forms.gle/H1zS9wVeurADwuvt7) | Address is self-reported, so the join is manual and mistypable. Works in a Discord message and needs no wallet. |

Neither is redundant. The in-app form has the better data; the Google Form reaches the person who
bounced at the wallet install — who is frequently the most useful respondent, and who the in-app
form structurally cannot hear from.

## What this form is for

There are already two feedback channels, and the form must not duplicate either:

| Channel | Knows | Cannot know |
|---|---|---|
| The indexer | Who deposited, how much, when, in which transaction | Who the person is, why they stopped |
| The in-app widget | A 1–5 rating and free text, from people who reached the app | Anything about people who never got that far |
| **This form** | Identity, background, intent, what blocked them | — |

So the form's job is the part no ledger can carry: **which human is behind an address, what they
wanted, and what would have to be true before they used it with real money.**

## The join key

**Field 1 is the wallet address, and it is what makes the whole thing checkable.** Every response
can be looked up in [`../evidence/depositors.csv`](../evidence/) — same column, `account`. In a
spreadsheet that is one `VLOOKUP`.

That cuts both ways, which is the point:

- A response whose address appears in `depositors.csv` is a person and a transaction, corroborating
  each other. Neither half is worth much alone.
- A response that claims a completed deposit at an address with no deposit is visible immediately.
- An address that deposited but never filled in the form is a person who left, which is the group
  worth chasing.

Ask for it early, while people still have the wallet open, and say plainly why: *"so we can match
your answers to your actual on-chain activity — testnet addresses are public and hold nothing of
value."*

---

## Core fields

Ten fields. Everything here earns its place; a form that takes longer than two minutes is the reason
submissions come in with three responses instead of ten.

### Identity and reach

**1. Stellar testnet address you used** — short text, **required**
Validation: 56 characters, starts with `G`. Regex `^G[A-Z2-7]{55}$`.
Help text: *"Starts with G. Copy it from your wallet. This is a testnet address, so it holds nothing
of value — we use it to match your answers to what actually happened on-chain."*

**2. Name or handle** — short text, **required**
How they want to be credited. Not a legal name.

**3. Contact — email, Telegram or X** — short text, **required**
A reviewer wanting to spot-check that testers exist needs a way to reach one. Also the only way to
close the loop and tell someone their complaint got fixed, which is what turns one response into a
returning user.

**4. Country** — short text or dropdown, optional
Geographic spread is a genuine strength in a Stellar submission and costs one field.

### Who they are — the user summary

**5. Which describes you best?** — single choice, **required**
- I hold XLM
- I use DeFi on another chain
- I build on Stellar
- I build on another chain
- I'm new to crypto
- Other

**6. Had you used a yield or lending product before this?** — single choice, **required**
- Yes, on Stellar (Blend, Aquarius, …)
- Yes, on another chain
- No, this was my first

**7. Do you hold XLM outside testnet?** — single choice, **required**
- Yes
- No
- Prefer not to say

Fields 5–7 are what makes "10 users" mean something. Ten Stellar developers who already use Blend is
a different result from ten people who had never touched DeFi, and both are more interesting than a
bare count.

### What they actually did

**8. What did you get done?** — checkboxes, multiple, **required**
- Connected a wallet
- Deposited XLM
- Saw my nXLM balance
- Saw the share price move
- Redeemed back to XLM
- Read the docs or the landing page
- I got stuck before depositing

Cross-checks against the chain: a box ticked for "deposited" with no matching row is a signal, and a
truthful *"I got stuck"* is the single most useful answer on the form.

**9. Which wallet?** — single choice, **required**
Freighter · xBull · Lobstr · Rabet · Hana · Albedo · Other

Cross-checks against the `wallet_connected` breakdown already in `/asdfg/admin` — and Albedo in
particular is worth watching, since it cannot sign the ownership challenge at all.

**10. If you got stuck, where?** — single choice, optional
- I didn't get stuck
- Installing a wallet
- Getting testnet XLM
- Connecting the wallet
- Understanding what nXLM is
- The deposit form
- Signing the transaction
- The transaction failed
- Something else

Deliberately the same vocabulary as the `deposit_failed` phase property, so the self-reported answer
and the telemetry can be compared instead of just coexisting.

---

## Validation fields

Level 4 asks for **product validation**, not only usage. These four are where that comes from, and
they are worth more than another usage question.

**11. If this were live on mainnet, how much of your own XLM would you deposit?** — single choice
- Nothing
- Under 100 XLM
- 100–1,000 XLM
- 1,000–10,000 XLM
- More than 10,000 XLM

The closest thing to a willingness-to-pay signal available without charging anyone. "Nothing" is a
useful answer and should not be made awkward to pick.

**12. What would have to be true before you used it with real money?** — long text, **required**
The best question on the form. Expect "an audit", "a track record", "I'd want to know where the
yield comes from" — and every one of those is a roadmap item stated by someone outside the project.

**13. How clear was it what nXLM is and how it earns?** — 1–5 scale
Anchor the ends: 1 = "no idea", 5 = "completely clear". This measures the writing, which is the
thing most easily fixed in a week.

**14. Anything confusing, broken, or missing?** — long text, **required**
Required, not optional. Optional free text is left blank by most people, and this is the field the
whole exercise exists for.

---

## Consent

**15. May we include your response in our submission?** — single choice, **required**
- Yes, with my name/handle and wallet address
- Yes, but anonymously — no name, no address
- No, keep it private

Not boilerplate. Testnet addresses are public on-chain already, but the *link* between an address
and a person's name is not, and this form is what would create it. Ask before publishing it, honour
"no", and report the count of private responses rather than quietly dropping them.

---

## Working the results

1. Export the form responses to CSV.
2. Run `cd indexer && npm run export` for the on-chain side.
3. Join on the address column. Three groups fall out, and all three are worth reporting:
   **corroborated** (form + deposit), **form only** (arrived, never deposited — read field 10),
   **chain only** (deposited, never responded).
4. For each concrete complaint, decide what changes and record it. The in-app reviews table already
   has an `actioned` column for exactly this; use the same discipline on form responses.
5. Summarize as *"n responses, m corroborated on-chain, k changes shipped as a result"* — with the
   changes listed. A reviewer will trust that far more than an average rating.

**Recruit before the form is perfect.** The fields above are one afternoon of work; ten people who
have actually used the thing are not, and cannot be produced in the final week. The contracts were
redeployed on 2026-08-14 for the security pass, so `evidence/depositors.csv` starts from one test
account and every real depositor from here is a genuine one. The plumbing is proven and the
requirement is not — and a reviewer reading that file will see exactly that.
