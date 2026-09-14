/**
 * Offering a booking's service line to a vendor, from the coordinator's side.
 *
 * An offer is always about one line of one booking, never the whole booking:
 * a package carrying a DJ, a photographer and a bouncy castle is three
 * different businesses, and modelling it as "assign the booking to a vendor"
 * would make the common case unrepresentable.
 *
 * Two checks run before an offer is written, both of which exist to stop a
 * vendor being told about work that is not real: the booking must actually
 * carry that service line, and the vendor must be listed for it.
 */

import { queryOne } from "../../db/pool.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";
import { newId } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { money } from "../pricing/pricing.engine.js";
import * as vendorRepo from "../vendors/vendors.repo.js";
import type { AssignmentRow } from "../vendors/vendors.repo.js";
import type { PricedLine } from "../pricing/pricing.types.js";

/** Postgres's unique_violation. A second offer to the same vendor for the
 *  same line trips it, and that reads better as a 409 than a 500. */
const UNIQUE_VIOLATION = "23505";

export const ASSIGNMENT_STATUSES = [
  "offered",
  "accepted",
  "declined",
  "withdrawn",
  "completed",
] as const;

function toDto(row: AssignmentRow & { business_name?: string; vendor_email?: string }) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    vendorId: row.vendor_id,
    vendorName: row.business_name ?? null,
    vendorEmail: row.vendor_email ?? null,
    serviceType: row.service_type,
    status: row.status,
    payoutCents: row.payout_cents,
    payoutLabel: row.payout_cents === null ? null : money(row.payout_cents),
    note: row.note,
    responseNote: row.response_note,
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAssignments(bookingId: string) {
  const booking = await queryOne<{ id: string; line_items: PricedLine[] }>(
    "SELECT id, line_items FROM event_booking_requests WHERE id = $1",
    [bookingId],
  );
  if (booking === null) throw notFound("We cannot find a booking request with that id.");

  const rows = await vendorRepo.listAssignmentsForBooking(bookingId);

  return {
    items: rows.map(toDto),
    // What the booking can be offered for, so the admin UI does not have to
    // re-derive the service list out of the raw line items.
    serviceLines: (booking.line_items ?? []).map((line) => ({
      serviceType: line.serviceType,
      label: line.label,
      customerCents: line.lineCents,
      customerLabel: money(line.lineCents),
    })),
  };
}

export async function createAssignment(
  bookingId: string,
  input: { vendorId: string; serviceType: string; payoutCents?: number | null; note?: string | null },
) {
  const booking = await queryOne<{ id: string; line_items: PricedLine[] }>(
    "SELECT id, line_items FROM event_booking_requests WHERE id = $1",
    [bookingId],
  );
  if (booking === null) throw notFound("We cannot find a booking request with that id.");

  const line = vendorRepo.lineFor(booking.line_items, input.serviceType);
  if (line === null) {
    throw badRequest(`This booking does not include a "${input.serviceType}" line.`);
  }

  const vendor = await vendorRepo.findVendorById(input.vendorId);
  if (vendor === null) throw notFound("We cannot find a vendor with that id.");
  if (!vendor.is_active) throw badRequest("That vendor is suspended and cannot be offered work.");
  if (!(vendor.service_types ?? []).includes(input.serviceType)) {
    throw badRequest(
      `${vendor.business_name} is not listed for "${input.serviceType}". Add it to their profile first.`,
    );
  }

  let row: AssignmentRow;
  try {
    row = await vendorRepo.insertAssignment({
      id: newId("asg"),
      bookingId,
      vendorId: input.vendorId,
      serviceType: input.serviceType,
      payoutCents: input.payoutCents ?? null,
      note: input.note ?? null,
    });
  } catch (err) {
    if ((err as { code?: string }).code === UNIQUE_VIOLATION) {
      throw conflict(`${vendor.business_name} has already been offered this line.`);
    }
    throw err;
  }

  logger.info("vendor offered a booking line", {
    assignmentId: row.id,
    bookingId,
    vendorId: input.vendorId,
    serviceType: input.serviceType,
  });

  return toDto({ ...row, business_name: vendor.business_name, vendor_email: vendor.email });
}

export async function updateAssignment(
  id: string,
  patch: { status?: string; payoutCents?: number | null; note?: string | null },
) {
  const current = await vendorRepo.findAssignmentById(id);
  if (current === null) throw notFound("We cannot find an assignment with that id.");

  const row = await vendorRepo.updateAssignment(id, patch);
  if (row === null) throw notFound("We cannot find an assignment with that id.");

  const vendor = await vendorRepo.findVendorById(row.vendor_id);
  return toDto({
    ...row,
    business_name: vendor?.business_name,
    vendor_email: vendor?.email,
  });
}

/**
 * Removes the offer outright, for one made in error. Withdrawing an offer the
 * vendor has already seen is a status change, not a delete — that way it stays
 * on their list with an explanation instead of vanishing.
 */
export async function deleteAssignment(id: string) {
  const removed = await vendorRepo.deleteAssignment(id);
  if (removed === 0) throw notFound("We cannot find an assignment with that id.");
}
