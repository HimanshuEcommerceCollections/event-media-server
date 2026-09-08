-- Initial schema.
--
-- Timestamps are BIGINT unix seconds rather than TIMESTAMPTZ: every one of
-- them is compared against a token expiry or a cooldown computed in seconds,
-- so keeping one unit end to end avoids converting on each read. Money is
-- always integer cents.

-- ------------------------------------------------------------------ accounts

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  -- Lowercased email. Uniqueness is enforced on this rather than on `email`
  -- so it is case-insensitive without a lookup having to remember to fold.
  email_key       TEXT NOT NULL UNIQUE,
  full_name       TEXT NOT NULL,
  password_hash   TEXT NOT NULL,
  email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_tos_at BIGINT,
  role            TEXT NOT NULL DEFAULT 'customer',
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL,
  last_signin_at  BIGINT
);

-- A refresh token is only honoured while its session row is live, which is
-- what makes sign-out possible at all: a JWT by itself cannot be revoked.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT,
  remember   BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent TEXT,
  ip         TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

-- One row per pending sign-in or sign-up. `purpose` decides what verifying it
-- does: verifying a signup also marks the email verified and grants the perk.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_key    TEXT NOT NULL,
  purpose      TEXT NOT NULL CHECK (purpose IN ('signup', 'signin')),
  code_digest  TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  remember     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   BIGINT NOT NULL,
  expires_at   BIGINT NOT NULL,
  last_sent_at BIGINT NOT NULL,
  consumed_at  BIGINT
);

-- Every lookup asks for the live challenge for one address, newest first.
CREATE INDEX IF NOT EXISTS idx_otp_live
  ON otp_challenges (email_key, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS password_resets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_digest TEXT NOT NULL UNIQUE,
  created_at   BIGINT NOT NULL,
  expires_at   BIGINT NOT NULL,
  consumed_at  BIGINT
);

-- The welcome gift drawn at sign-up. One per user; marked revealed once the
-- scratch card is scratched through, so the reveal survives a reload.
CREATE TABLE IF NOT EXISTS perks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  perk_key    TEXT NOT NULL,
  label       TEXT NOT NULL,
  description TEXT NOT NULL,
  granted_at  BIGINT NOT NULL,
  revealed_at BIGINT,
  redeemed_at BIGINT,
  expires_at  BIGINT
);

-- ------------------------------------------------------------------- content

CREATE TABLE IF NOT EXISTS services (
  slug         TEXT PRIMARY KEY,
  no           TEXT NOT NULL,
  title        TEXT NOT NULL,
  blurb        TEXT NOT NULL,
  price_label  TEXT NOT NULL,
  price_cents  BIGINT,
  price_unit   TEXT,
  is_b2b       BOOLEAN NOT NULL DEFAULT FALSE,
  image_path   TEXT NOT NULL,
  image_alt    TEXT NOT NULL,
  icon_key     TEXT NOT NULL,
  hero         JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order   INTEGER NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

-- The per-service page content: intro points, pricing rows, add-ons, presets,
-- FAQs, gallery. The shapes differ per service (a rentals item carries a
-- quantity step, a photo pack carries a duration), so a block is stored as
-- JSONB and `kind` says which shape to expect.
CREATE TABLE IF NOT EXISTS service_blocks (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL REFERENCES services(slug) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  payload    JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blocks_slug ON service_blocks (slug, kind, sort_order);

CREATE TABLE IF NOT EXISTS featured_events (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  year        INTEGER NOT NULL,
  total_cents BIGINT NOT NULL,
  total_label TEXT NOT NULL,
  image_path  TEXT NOT NULL,
  image_alt   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  key        TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS testimonials (
  id          TEXT PRIMARY KEY,
  quote       TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  initials    TEXT NOT NULL,
  surface     TEXT NOT NULL DEFAULT 'home',
  sort_order  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stats (
  key        TEXT PRIMARY KEY,
  value      NUMERIC NOT NULL,
  decimals   INTEGER NOT NULL DEFAULT 0,
  prefix     TEXT NOT NULL DEFAULT '',
  suffix     TEXT NOT NULL DEFAULT '',
  label      TEXT NOT NULL,
  surface    TEXT NOT NULL DEFAULT 'home',
  sort_order INTEGER NOT NULL
);

-- The review wall, its spotlight carousel and the rating histogram derived
-- from it.
CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  category_key  TEXT NOT NULL,
  service_label TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  initials      TEXT NOT NULL,
  avatar_color  TEXT NOT NULL,
  stars         INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body          TEXT NOT NULL,
  when_label    TEXT NOT NULL,
  is_spotlight  BOOLEAN NOT NULL DEFAULT FALSE,
  -- The carousel shows a longer cut of the quote and a more specific tag than
  -- the wall card does, so both are stored beside the wall copy rather than
  -- the entry being duplicated as a second row.
  spotlight_quote TEXT,
  spotlight_tag   TEXT,
  image_path    TEXT,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_published ON reviews (sort_order) WHERE is_published;

-- Photo strips and polaroid walls, keyed by the page that shows them.
CREATE TABLE IF NOT EXISTS gallery_items (
  id         TEXT PRIMARY KEY,
  surface    TEXT NOT NULL,
  image_path TEXT NOT NULL,
  label      TEXT NOT NULL,
  caption    TEXT,
  sort_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gallery_surface ON gallery_items (surface, sort_order);

-- Privacy and terms. Sections are JSONB in document order.
CREATE TABLE IF NOT EXISTS legal_documents (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  kicker        TEXT NOT NULL,
  summary       TEXT NOT NULL,
  updated_label TEXT NOT NULL,
  sections      JSONB NOT NULL,
  updated_at    BIGINT NOT NULL
);

-- ------------------------------------------------------------------ activity

-- A star tapped on the reviews page. Anonymous unless the caller sends a
-- token, so it needs no account.
CREATE TABLE IF NOT EXISTS rating_pulses (
  id         TEXT PRIMARY KEY,
  stars      INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  ip         TEXT,
  created_at BIGINT NOT NULL
);

-- The "one request, whole event covered" enquiry. Line items are JSONB
-- because their shape depends on which service page built the quote.
CREATE TABLE IF NOT EXISTS quote_requests (
  id           TEXT PRIMARY KEY,
  reference    TEXT NOT NULL UNIQUE,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL,
  phone        TEXT,
  event_date   TEXT,
  service_slug TEXT REFERENCES services(slug) ON DELETE SET NULL,
  line_items   JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cents  BIGINT NOT NULL DEFAULT 0,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  created_at   BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quotes_user ON quote_requests (user_id, created_at DESC);
