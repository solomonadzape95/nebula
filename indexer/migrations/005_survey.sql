-- The structured user survey.
--
-- App-owned, like `profiles` and `reviews` in 002: it is not a projection of anything on-chain and
-- a delete-and-replay of the event tables must not take it with it.
--
-- Why a table and not a Google Form: `address` is the join key to `user_actions`, so a response and
-- the deposit it claims corroborate each other automatically. A form export needs that join done by
-- hand in a spreadsheet, and a hand-typed address is the field people get wrong. Here the address
-- comes from a wallet that signed a session challenge, so it cannot be typed wrong or borrowed.
--
-- Deliberately mirrors docs/USER_SURVEY.md field for field. Free text is stored as given; the
-- single-choice fields are stored as their literal option strings rather than as enums, because a
-- CHECK constraint here would mean a migration every time a question is reworded, and the form is
-- the authority on what may be submitted.

CREATE TABLE IF NOT EXISTS survey_responses (
  id           bigserial PRIMARY KEY,

  -- Field 1. The join key. Never typed — taken from the signed wallet session.
  address      text        NOT NULL,

  -- Fields 2-4. Identity and reach.
  handle       text        NOT NULL CHECK (length(btrim(handle)) > 0),
  contact      text        NOT NULL CHECK (length(btrim(contact)) > 0),
  country      text,

  -- Fields 5-7. Who they are. This is what makes "10 users" mean something: ten Stellar developers
  -- who already use Blend is a different result from ten people new to DeFi.
  background   text        NOT NULL,
  used_yield   text        NOT NULL,
  holds_xlm    text        NOT NULL,

  -- Fields 8-10. What they actually did. `did` is multi-select, so an array.
  did          text[]      NOT NULL DEFAULT '{}',
  wallet       text        NOT NULL,
  stuck_where  text,

  -- Fields 11-14. Validation — the half that is about the product rather than the session.
  mainnet_size text,
  requirements text        NOT NULL CHECK (length(btrim(requirements)) > 0),
  clarity      integer     NOT NULL CHECK (clarity BETWEEN 1 AND 5),
  issues       text        NOT NULL CHECK (length(btrim(issues)) > 0),

  -- Field 15. Consent to publish. Not boilerplate: testnet addresses are already public, but the
  -- link between an address and a person's name is not, and this form is what creates it.
  consent      text        NOT NULL,

  created_at   timestamptz NOT NULL DEFAULT now(),

  -- What changed because of it. Null until someone acts on it, same discipline as `reviews`.
  actioned     text
);

-- One response per address. A second submission replaces the first rather than inflating the
-- count — the response total is evidence, and evidence that double-counts is worth nothing.
CREATE UNIQUE INDEX IF NOT EXISTS survey_responses_address_key ON survey_responses (address);

CREATE INDEX IF NOT EXISTS survey_responses_created_idx ON survey_responses (created_at DESC);
