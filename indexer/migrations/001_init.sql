-- Nebula indexer schema.
--
-- Design note: every table hangs off `events`, which stores the raw decoded event exactly once,
-- keyed by the RPC's own event id. That id is stable and unique, so re-running a sync over a range
-- already ingested is a no-op rather than a duplicate. Derived tables cascade from it, so a
-- correction is a delete-and-replay rather than a migration.

CREATE TABLE IF NOT EXISTS sync_state (
  id               integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor           text,
  last_ledger      bigint      NOT NULL DEFAULT 0,
  -- Soroban RPC only retains recent events. If our cursor ever falls behind the RPC's oldest
  -- retained ledger, events are gone for good — so we record what we last saw and shout about it.
  oldest_available bigint      NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS events (
  id               text PRIMARY KEY,
  ledger           bigint      NOT NULL,
  ledger_closed_at timestamptz NOT NULL,
  tx_hash          text        NOT NULL,
  contract_id      text        NOT NULL,
  kind             text        NOT NULL,
  data             jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS events_kind_time_idx ON events (kind, ledger_closed_at DESC);
CREATE INDEX IF NOT EXISTS events_ledger_idx    ON events (ledger DESC);

-- One row per user-facing deposit or withdrawal.
--
-- This table is the Level 4 "proof of 10+ user wallet interactions" evidence: every row is an
-- address, an amount, and a transaction hash anyone can check on Stellar Expert.
CREATE TABLE IF NOT EXISTS user_actions (
  event_id         text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  account          text          NOT NULL,
  action           text          NOT NULL CHECK (action IN ('deposit', 'withdraw')),
  assets           numeric(40,0) NOT NULL,
  shares           numeric(40,0) NOT NULL,
  tx_hash          text          NOT NULL,
  ledger_closed_at timestamptz   NOT NULL
);

CREATE INDEX IF NOT EXISTS user_actions_account_idx ON user_actions (account);
CREATE INDEX IF NOT EXISTS user_actions_time_idx    ON user_actions (ledger_closed_at DESC);

-- Share price and TVL, sampled from every event that carries them.
--
-- Deposit, Withdraw, and Harvest all embed share_price and total_assets precisely so this series
-- can be rebuilt from events alone, with no contract state reads and no backfill problem.
CREATE TABLE IF NOT EXISTS vault_samples (
  event_id         text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  ledger           bigint        NOT NULL,
  ledger_closed_at timestamptz   NOT NULL,
  share_price      numeric(40,0) NOT NULL,
  total_assets     numeric(40,0) NOT NULL
);

CREATE INDEX IF NOT EXISTS vault_samples_time_idx ON vault_samples (ledger_closed_at);

-- Realized yield, per harvest.
CREATE TABLE IF NOT EXISTS harvests (
  event_id         text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  gross            numeric(40,0) NOT NULL,
  fee              numeric(40,0) NOT NULL,
  net              numeric(40,0) NOT NULL,
  ledger_closed_at timestamptz   NOT NULL
);

-- Capital moving between the vault reserve and a strategy.
CREATE TABLE IF NOT EXISTS strategy_flows (
  event_id         text PRIMARY KEY REFERENCES events (id) ON DELETE CASCADE,
  strategy         text          NOT NULL,
  direction        text          NOT NULL CHECK (direction IN ('allocate', 'unwind')),
  amount           numeric(40,0) NOT NULL,
  ledger_closed_at timestamptz   NOT NULL
);

CREATE INDEX IF NOT EXISTS strategy_flows_strategy_idx ON strategy_flows (strategy);
