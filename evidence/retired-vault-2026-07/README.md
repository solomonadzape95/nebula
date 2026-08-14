# Retired vault — archived record

**This is not current traction. It is the history of a contract that no longer takes deposits.**

| | |
|---|---|
| Vault | `CDGRL2EMFMLOCD6NRUKCL6CPNAF4SWK4DLQIM2AGFIN5P5CK3VXTUPHO` |
| Share token | `CAVRFADYBNPLRL734VGRS6FW4LXRDEKRZZDQCSMB7VXCFZPDZ5JB3SN2` |
| Active | 2026-07-27 to 2026-07-28 |
| Retired | 2026-08-14 |
| Depositing addresses | 11 |
| Transactions | 17 |

## Why it was retired

The contracts were redeployed on 2026-08-14 to pick up the security pass — `mark_to_market`, the
sweep guard on the share token, the `vault()` check in `add_strategy`, and a burn that any holder
could call. The vault above has none of those fixes. The live deployment is in
[`../../deployments/testnet.json`](../../deployments/testnet.json), and the current record is one
directory up in [`../`](../).

## Why it is still here

Every row happened. The transactions are on a public ledger, each with its own hash and explorer
link, and they cannot be un-made by being inconvenient. A record that gets pruned when the numbers
stop flattering is not a record, and a file caught hiding one thing is not believed about anything
else it says.

These rows also proved the parts of the system that are hard to prove any other way: the event
decoding, the accounting, the harvest loop, and the invariant `total_assets == idle + Σ deployed`
holding across 17 real transactions. That work is not invalidated by the redeploy.

## What it does not show

**All 11 addresses are self-generated.** They were funded minutes apart from the same faucet while
the deposit path was being tested. `depositors.csv` carries `days_active` per address and every one
reads `1`, which is exactly what a batch scripted in one sitting looks like; `summary.csv` says the
same thing as `depositors_active_on_more_than_one_day: 0`.

So this directory is evidence that the plumbing works. It has never been evidence of a user base,
and it is not offered as any.

## Why it is not summed with the live vault

The indexer keeps both vaults' events in one database, and every query is scoped by
`events.contract_id` so the two are never added together. Before that scoping existed, the stats
page showed a share price read from the live contract beside yield totals accumulated by this one —
a pair of numbers that described nothing. Nothing here is deleted; it is only kept separate.
