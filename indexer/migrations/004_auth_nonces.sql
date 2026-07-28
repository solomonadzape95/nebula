-- Challenge nonces that have already been spent.
--
-- The sign-in challenge is carried in a signed, expiring cookie, which proves the server issued it
-- and pins how long it lives — but not that it has only been used once. Deleting a cookie is a
-- request to one browser, not a fact about the world: whoever holds the cookie value alongside the
-- signed challenge can present the pair again until it expires, and be issued a session for an
-- address they do not control. Single-use has to be recorded somewhere the server owns.
--
-- The primary key is what enforces it. `proveOwnership` inserts the nonce with ON CONFLICT DO
-- NOTHING and treats zero rows as a replay, so the check and the claim are the same atomic
-- operation and two simultaneous submissions cannot both win.
CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce      text        PRIMARY KEY,
  address    text        NOT NULL,
  used_at    timestamptz NOT NULL DEFAULT now(),
  -- Rows are only interesting until the challenge they belong to would have expired anyway.
  expires_at timestamptz NOT NULL
);

-- Supports the opportunistic cleanup that runs alongside each insert, so the table stays roughly
-- the size of one challenge window rather than growing for the life of the deployment.
CREATE INDEX IF NOT EXISTS auth_nonces_expiry_idx ON auth_nonces (expires_at);
