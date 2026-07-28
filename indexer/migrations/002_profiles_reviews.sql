-- App-owned tables.
--
-- Everything in 001 is a projection of on-chain events and can be rebuilt by replaying them. These
-- two cannot: a username and a review exist nowhere but here. They live in the same database so
-- there is one connection string to configure, but they are never touched by the indexer, and a
-- delete-and-replay of the event tables must not take them with it.

CREATE TABLE IF NOT EXISTS profiles (
  address    text PRIMARY KEY,
  username   text        NOT NULL,
  -- Hue 0-359. The avatar is generated from the address, so this is the one thing about it a
  -- person gets to choose.
  hue        integer     NOT NULL DEFAULT 150 CHECK (hue >= 0 AND hue < 360),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness. "nebula" and "Nebula" being different people is a support problem
-- waiting to happen, and an impersonation vector.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON profiles (lower(username));

CREATE TABLE IF NOT EXISTS reviews (
  id         bigserial PRIMARY KEY,
  address    text        NOT NULL,
  rating     integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body       text        NOT NULL CHECK (length(btrim(body)) > 0),
  -- Whether they actually managed a deposit. A review from someone who got stuck is the most
  -- useful kind, and worth being able to filter for.
  deposited  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- What changed because of it. Null until someone acts on it.
  actioned   text
);

CREATE INDEX IF NOT EXISTS reviews_created_idx ON reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_address_idx ON reviews (address);
