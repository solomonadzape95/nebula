# Nebula Indexer

Ingests Nebula vault events from Soroban RPC into Postgres, so the dashboard can show TVL and
share-price history without hammering the chain — and so there is a durable record of who used the
protocol.

## Why it exists

Two jobs:

1. **Feed the dashboard.** `Deposit`, `Withdraw`, and `Harvest` each embed `share_price` and
   `total_assets`, so the entire price series is reconstructible from events alone. No contract
   state reads, no backfill problem.
2. **Prove real usage.** `npm run depositors` prints every address that has ever deposited with a
   transaction hash anyone can check on Stellar Expert.

## Quick start

```bash
cp .env.example .env          # point DATABASE_URL at Postgres
npm install
npm run db:up                 # local Postgres in Docker (skip if you have your own)
npm run migrate
npm run sync                  # ingest once
npm run stats
```

Contract addresses are read from `../deployments/<network>.json`, the file the deploy scripts
write — the indexer, the frontend, and the contracts can never disagree about which vault is meant.

## Commands

| Command | Does |
|---|---|
| `npm run migrate` | Create or update the schema |
| `npm run sync` | Ingest new events once, then exit — **use this from cron** |
| `npm run watch` | Ingest continuously |
| `npm run stats` | TVL, share price, depositor count, yield, realized APY |
| `npm run depositors` | Every depositing address with tx hashes — the proof-of-users evidence |
| `npm run export [dir]` | The whole record as CSV, into `../evidence/` by default |
| `npx tsx src/main.ts flows` | Capital allocated to and unwound from each strategy |

`export` writes six files rather than one sheet, because the record is six related tables and
flattening them would either lose the per-transaction detail or repeat every wallet on every row.
Files are overwritten in place and `summary.csv` stamps `exported_at_utc`, so what is on disk is
always one run's worth of a consistent snapshot. See [`../evidence/README.md`](../evidence/README.md)
for what each file contains and what it can and cannot prove.

## Deployment

`sync` is a single-shot command that exits, so the cheapest reliable deployment is a scheduled
job rather than a server. `.github/workflows/indexer.yml` runs it every 10 minutes against a
hosted Postgres. Set a `DATABASE_URL` repository secret and it works with no infrastructure.

For local development `watch` is more convenient.

## Two things that will bite you

**Soroban RPC only retains recent events.** Testnet keeps roughly a week. If the indexer is down
longer than the retention window, the events in that gap are gone from RPC permanently and no
amount of re-syncing brings them back. The indexer detects this, logs a `GAP` warning, and exits
non-zero so a scheduled run fails loudly rather than silently under-reporting. **This is the
argument for running it on a schedule from day one, not the week before submission.**

**An empty page does not mean "caught up".** RPC scans a bounded slice of ledgers per call and
returns zero matches for most of them, so pagination continues until the *cursor* reaches the head
ledger — page size says nothing about progress. Treating a short page as the end silently stops
the indexer a hundred thousand ledgers short, with no error. That bug was real; see
`cursorLedger` in `src/sync.ts`.

## Design notes

- **Ingestion is idempotent.** Every row is keyed by the RPC's own event id with
  `ON CONFLICT DO NOTHING`, so re-reading a range is free. A cron-driven indexer re-reads the tail
  of the last page constantly.
- **Raw events are kept forever.** Derived tables cascade from `events`, so a decoding fix is a
  delete-and-replay rather than a schema migration.
- **Unknown events do not crash the sync.** A contract upgrade that adds an event stores it raw
  under `kind = 'unknown'` to be backfilled later. Likewise a single undecodable event is skipped
  rather than blocking every event behind it forever.
- **`numeric(40,0)` is parsed as a string, not a float.** i128 stroop amounts exceed
  `Number.MAX_SAFE_INTEGER`; a rounded balance is a wrong balance.
- **Realized APY returns null under 6 hours of history.** Annualizing a few minutes of data yields
  numbers in the thousands of percent — arithmetically the formula's output, but a lie on a
  dashboard.

## Schema

| Table | Holds |
|---|---|
| `events` | Every decoded event, keyed by RPC event id. The source of truth. |
| `user_actions` | One row per deposit/withdraw — the depositor evidence |
| `vault_samples` | Share price and TVL over time, for the chart and APY |
| `harvests` | Realized yield, gross/fee/net |
| `strategy_flows` | Capital allocated to and unwound from each strategy |
| `sync_state` | Cursor, position, and the RPC retention floor last observed |
