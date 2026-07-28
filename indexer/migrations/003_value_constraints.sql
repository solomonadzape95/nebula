-- Bounds on the numbers, and room for the loss event.
--
-- Every value in these tables is decoded from a contract event, and the range checks in the decoder
-- are the first line rather than the only one. The decoder is a program that can be wrong; a column
-- constraint is enforced whatever wrote the row, including a future backfill script or a hand-run
-- INSERT during an incident. A negative `assets` would quietly subtract from the SUM behind the
-- depositor totals and the TVL chart, which is the kind of wrong that looks plausible.

ALTER TABLE user_actions DROP CONSTRAINT IF EXISTS user_actions_assets_non_negative;
ALTER TABLE user_actions ADD  CONSTRAINT user_actions_assets_non_negative CHECK (assets >= 0);

ALTER TABLE user_actions DROP CONSTRAINT IF EXISTS user_actions_shares_non_negative;
ALTER TABLE user_actions ADD  CONSTRAINT user_actions_shares_non_negative CHECK (shares >= 0);

-- A share price of zero would make the APY calculation divide by it, and the vault cannot produce
-- one: the virtual offset in the share maths keeps the denominator at 1 or above.
ALTER TABLE vault_samples DROP CONSTRAINT IF EXISTS vault_samples_price_positive;
ALTER TABLE vault_samples ADD  CONSTRAINT vault_samples_price_positive CHECK (share_price > 0);

ALTER TABLE vault_samples DROP CONSTRAINT IF EXISTS vault_samples_assets_non_negative;
ALTER TABLE vault_samples ADD  CONSTRAINT vault_samples_assets_non_negative CHECK (total_assets >= 0);

-- `gross` and `fee` are amounts that physically moved, so they cannot be negative. `net`
-- deliberately can: the vault now recognises strategy losses during harvest, and a period where
-- the venues lost more than they earned reports a negative figure. That is the number being
-- honest, so no constraint here.
ALTER TABLE harvests DROP CONSTRAINT IF EXISTS harvests_gross_non_negative;
ALTER TABLE harvests ADD  CONSTRAINT harvests_gross_non_negative CHECK (gross >= 0);

ALTER TABLE harvests DROP CONSTRAINT IF EXISTS harvests_fee_non_negative;
ALTER TABLE harvests ADD  CONSTRAINT harvests_fee_non_negative CHECK (fee >= 0);

ALTER TABLE strategy_flows DROP CONSTRAINT IF EXISTS strategy_flows_amount_non_negative;
ALTER TABLE strategy_flows ADD  CONSTRAINT strategy_flows_amount_non_negative CHECK (amount >= 0);

-- Capital leaving a strategy because it lost value is a third direction. It is not an `unwind`:
-- nothing came back to the reserve, which is the whole difference worth recording.
ALTER TABLE strategy_flows DROP CONSTRAINT IF EXISTS strategy_flows_direction_check;
ALTER TABLE strategy_flows ADD  CONSTRAINT strategy_flows_direction_check
  CHECK (direction IN ('allocate', 'unwind', 'loss'));
