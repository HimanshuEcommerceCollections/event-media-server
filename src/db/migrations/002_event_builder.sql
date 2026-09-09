-- The event builder, the vendor pipeline and the pages the catalogue tables
-- did not cover.
--
-- `quote_requests` is replaced rather than extended. It modelled one enquiry
-- against one service; the builder submits one request carrying N configured
-- services, with the event itself (type, headcount band, zip) as first-class
-- columns because the large-event rule reads them. It held no production
-- rows — nothing submitted to it — so it is dropped outright.

DROP TABLE IF EXISTS quote_requests;

-- ------------------------------------------------------------------- counters

-- Reference numbers are EVM-2026-0001: a per-year, per-kind counter rather
-- than a random string, so they read as sequential to whoever answers them.
-- The counter is bumped by an INSERT .. ON CONFLICT DO UPDATE .. RETURNING,
-- which is atomic under concurrency without a lock being taken by hand.
CREATE TABLE IF NOT EXISTS reference_counters (
  kind       TEXT    NOT NULL,
  year       INTEGER NOT NULL,
  next_value INTEGER NOT NULL,
  PRIMARY KEY (kind, year)
);

-- ------------------------------------------------------------------- bundles

-- A package that seeds the builder: /packages may stub, but the convention it
-- deposits is live here so a bundle can pre-tick and pre-configure tiles.
CREATE TABLE IF NOT EXISTS bundles (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL,
  blurb       TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  badge       TEXT,
  image_path  TEXT,
  image_alt   TEXT,
  sort_order  INTEGER NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

-- One line the bundle pre-fills. `configuration` is the same shape the builder
-- posts for that service, so seeding a bundle and configuring a tile by hand
-- reach the pricing engine by exactly one path.
CREATE TABLE IF NOT EXISTS bundle_items (
  id           TEXT PRIMARY KEY,
  bundle_slug  TEXT NOT NULL REFERENCES bundles(slug) ON DELETE CASCADE,
  service_slug TEXT NOT NULL REFERENCES services(slug) ON DELETE CASCADE,
  configuration JSONB NOT NULL,
  sort_order   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bundle_items ON bundle_items (bundle_slug, sort_order);

-- --------------------------------------------------------- booking requests

CREATE TABLE IF NOT EXISTS event_booking_requests (
  id               TEXT PRIMARY KEY,
  -- EVM-2026-0001. Unique so a retry cannot mint a duplicate.
  request_id       TEXT NOT NULL UNIQUE,
  brand            TEXT NOT NULL DEFAULT 'events',
  user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,

  event_type       TEXT NOT NULL,
  -- A calendar day chosen in the visitor's locale, not an instant: stored as
  -- an ISO date string so no timezone can move it across a day boundary.
  event_date       TEXT,
  headcount_band   TEXT NOT NULL
    CHECK (headcount_band IN ('1-25', '26-50', '51-100', '100+')),
  event_zip        TEXT,
  -- Derived on the server from event_type and headcount_band, never accepted
  -- from the client: the banner and the summary caveat both key off it.
  large_event_flag BOOLEAN NOT NULL DEFAULT FALSE,

  -- [{ service_type, configuration, line_price, label, breakdown, bundle_id }]
  -- Every line_price is priced from the catalogue, so this is a record of what
  -- was quoted rather than what the browser claimed.
  line_items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_total    BIGINT NOT NULL DEFAULT 0,

  budget_band      TEXT,
  -- { fullName, email, phone? } — kept together because they are only ever
  -- read as a block, by whoever answers the request.
  contact          JSONB NOT NULL,
  notes            TEXT,
  -- Which surface built it: the builder, a service page, or a bundle.
  source           TEXT NOT NULL DEFAULT 'build',
  status           TEXT NOT NULL DEFAULT 'new',
  created_at       BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON event_booking_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON event_booking_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_large ON event_booking_requests (created_at DESC)
  WHERE large_event_flag;

-- ----------------------------------------------------- vendor applications

CREATE TABLE IF NOT EXISTS vendor_applications (
  id             TEXT PRIMARY KEY,
  reference      TEXT NOT NULL UNIQUE,
  user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  business_name  TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  website        TEXT,
  -- The service slugs applied for; a vendor may cover several.
  service_types  JSONB NOT NULL DEFAULT '[]'::jsonb,
  years_active   INTEGER,
  service_area   TEXT,
  has_insurance  BOOLEAN NOT NULL DEFAULT FALSE,
  -- { certificateNumber, expiresOn, documentName } when drone-video is among
  -- the service types. Collected, deliberately not validated — no FAA lookup
  -- happens here and nothing downstream may read this as a certification.
  part107        JSONB,
  portfolio_url  TEXT,
  notes          TEXT,
  status         TEXT NOT NULL DEFAULT 'new',
  created_at     BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vendor_apps_status
  ON vendor_applications (status, created_at DESC);

-- ------------------------------------------------------------------- pages

-- The narrative pages: how-it-works, about, faq, commercial, pricing, build.
-- Sections are JSONB in document order for the same reason legal_documents
-- stores them that way — the shape differs per section kind and the page owns
-- how to render it.
CREATE TABLE IF NOT EXISTS content_pages (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  kicker     TEXT NOT NULL DEFAULT '',
  summary    TEXT NOT NULL DEFAULT '',
  hero       JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections   JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at BIGINT NOT NULL
);

-- ---------------------------------------------------------------- analytics

-- build_add_service and build_total_view land here. Stubbed by design: the
-- rows are kept so the funnel can be counted, and nothing reads them yet.
CREATE TABLE IF NOT EXISTS analytics_events (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  -- An opaque per-visitor key from the client. Not a user id and not an
  -- identifier we mint, so it cannot be joined back to a person.
  session_key TEXT,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_name ON analytics_events (name, created_at DESC);
