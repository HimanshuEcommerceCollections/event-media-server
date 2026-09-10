-- Backing for the admin API: status enums enforced at the database, and an
-- updated_at on the two request tables so a status change can be timestamped.
--
-- Both tables default status to 'new' already, so no existing row can violate
-- the CHECK being added here.

ALTER TABLE event_booking_requests
  ADD CONSTRAINT event_booking_requests_status_check
    CHECK (status IN ('new', 'confirmed', 'in_progress', 'completed', 'cancelled'));

ALTER TABLE event_booking_requests ADD COLUMN updated_at BIGINT;
UPDATE event_booking_requests SET updated_at = created_at;
ALTER TABLE event_booking_requests ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE vendor_applications
  ADD CONSTRAINT vendor_applications_status_check
    CHECK (status IN ('new', 'reviewing', 'approved', 'rejected'));

ALTER TABLE vendor_applications ADD COLUMN updated_at BIGINT;
UPDATE vendor_applications SET updated_at = created_at;
ALTER TABLE vendor_applications ALTER COLUMN updated_at SET NOT NULL;
