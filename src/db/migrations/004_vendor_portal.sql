-- The vendor portal.
--
-- An application that a coordinator approves stops being a piece of paper and
-- becomes an account: a `users` row with role 'vendor' and a `vendors` profile
-- hanging off it. The coordinator then offers that vendor one service line of
-- a booking, and the vendor accepts or declines it from their own dashboard.
--
-- `vendor_applications` is kept exactly as it is. It is the record of what was
-- submitted and when it was reviewed; `vendors` is the live profile, which the
-- vendor edits afterwards and which must not rewrite what they originally
-- claimed.

-- ------------------------------------------------------------------- roles

-- `role` was free text with 'customer' and 'admin' the only two ever written.
-- The portal adds a third, and the constraint stops a typo minting a role no
-- middleware knows about — which would read as "not an admin, not a vendor"
-- and silently lock the account out of both.
ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin', 'vendor'));

-- ----------------------------------------------------------------- vendors

CREATE TABLE IF NOT EXISTS vendors (
  id             TEXT PRIMARY KEY,
  -- One profile per account. Dropping the account drops the profile: without
  -- a sign-in there is nothing left that can act as this vendor.
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- The application this grew out of. Nullable so a coordinator can also
  -- onboard a vendor who never filled the form in.
  application_id TEXT REFERENCES vendor_applications(id) ON DELETE SET NULL,

  business_name  TEXT NOT NULL,
  contact_name   TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  website        TEXT,
  -- The service slugs this vendor may be offered work for. Seeded from the
  -- application and thereafter the coordinator's call, not the vendor's.
  service_types  JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_area   TEXT,
  years_active   INTEGER,
  has_insurance  BOOLEAN NOT NULL DEFAULT FALSE,
  portfolio_url  TEXT,
  -- Free text the vendor writes about themselves. Not shown to visitors yet.
  bio            TEXT,
  -- Suspends a vendor without deleting the history hanging off them: an
  -- inactive vendor is offered nothing and cannot answer an open offer.
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);

-- "Who can I offer this drone line to?" is the one question the directory is
-- ever asked, and it is a containment test against the JSONB array.
CREATE INDEX IF NOT EXISTS idx_vendors_service_types ON vendors USING GIN (service_types);
CREATE INDEX IF NOT EXISTS idx_vendors_application ON vendors (application_id);

-- ------------------------------------------------------- booking assignments

-- One row per (booking, vendor, service line). A booking carrying six services
-- can be split across six vendors, and a service can be re-offered to someone
-- else after a decline — which is why the unique key includes the vendor
-- rather than stopping at the service.
CREATE TABLE IF NOT EXISTS booking_assignments (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT NOT NULL REFERENCES event_booking_requests(id) ON DELETE CASCADE,
  vendor_id    TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  -- The service slug this offer covers. Matched against the booking's
  -- line_items when the offer is made; stored flat so the vendor's list does
  -- not have to dig through the booking to know what it is being asked for.
  service_type TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'offered'
    CHECK (status IN ('offered', 'accepted', 'declined', 'withdrawn', 'completed')),
  -- What the vendor is paid for this line, in integer cents. Deliberately not
  -- derived from the line's own price: what the customer pays and what the
  -- vendor keeps are different numbers and the coordinator sets the second.
  payout_cents BIGINT,
  -- The coordinator's brief to the vendor, and the vendor's answer.
  note          TEXT,
  response_note TEXT,
  offered_at    BIGINT NOT NULL,
  responded_at  BIGINT,
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL,
  -- The same vendor cannot hold two live offers for the same line.
  UNIQUE (booking_id, vendor_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_assignments_vendor
  ON booking_assignments (vendor_id, status, offered_at DESC);
CREATE INDEX IF NOT EXISTS idx_assignments_booking
  ON booking_assignments (booking_id, offered_at DESC);
