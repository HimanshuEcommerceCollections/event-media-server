/**
 * The vendor's own view of the platform: their profile, the work they have
 * been offered, and what answering an offer does.
 *
 * One rule shapes every DTO here — a vendor sees the job, not the customer.
 * The event, the date, the area and their own payout are what they need to
 * decide; the customer's name, email and phone are withheld until the offer
 * has actually been accepted, and what the customer paid for the line is
 * never shown at all. The two numbers are not the same and conflating them
 * would tell a vendor the platform's margin.
 */

import { badRequest, conflict, notFound } from "../../lib/http.js";
import { nowSeconds } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { money } from "../pricing/pricing.engine.js";
import * as repo from "./vendors.repo.js";
import type { AssignmentWithBookingRow, VendorRow } from "./vendors.repo.js";

/** Statuses a vendor may move an offer into, and what it has to be first. */
const RESPONSES = {
  accept: { from: ["offered"], to: "accepted" },
  decline: { from: ["offered"], to: "declined" },
} as const;

export type ResponseAction = keyof typeof RESPONSES;

/** Offers in these states are work the vendor still owes or has delivered. */
const EARNING_STATUSES = new Set(["accepted", "completed"]);

export function toVendorDto(row: VendorRow) {
  return {
    id: row.id,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    serviceTypes: row.service_types ?? [],
    serviceArea: row.service_area,
    yearsActive: row.years_active,
    hasInsurance: row.has_insurance,
    portfolioUrl: row.portfolio_url,
    bio: row.bio,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAssignmentDto(row: AssignmentWithBookingRow) {
  const line = repo.lineFor(row.line_items, row.service_type);
  // Accepted means the vendor is doing the job, so they need to be able to
  // reach whoever they are doing it for. Before that they do not.
  const contactVisible = EARNING_STATUSES.has(row.status);

  return {
    id: row.id,
    status: row.status,
    serviceType: row.service_type,
    // The label the pricing engine put on the line, so the vendor reads the
    // same wording the customer was quoted rather than a bare slug.
    serviceLabel: line?.label ?? row.service_type,
    configuration: line?.configuration ?? null,
    // What the customer asked for, itemised — without the money, which is the
    // customer's price and not the vendor's.
    requirements: (line?.breakdown ?? []).map((part) => ({ label: part.label, detail: part.detail })),
    payoutCents: row.payout_cents,
    payoutLabel: row.payout_cents === null ? null : money(row.payout_cents),
    note: row.note,
    responseNote: row.response_note,
    offeredAt: row.offered_at,
    respondedAt: row.responded_at,
    booking: {
      requestId: row.request_id,
      status: row.booking_status,
      eventType: row.event_type,
      eventDate: row.event_date,
      headcountBand: row.headcount_band,
      eventZip: row.event_zip,
      largeEventFlag: row.large_event_flag,
      contact: contactVisible ? row.contact : null,
    },
  };
}

/* ----------------------------------------------------------------- profile */

export async function getMyProfile(vendor: VendorRow) {
  const summary = await repo.summariseVendorWork(vendor.id);

  const byStatus: Record<string, number> = {
    offered: 0,
    accepted: 0,
    declined: 0,
    withdrawn: 0,
    completed: 0,
  };
  let earningsCents = 0;
  for (const row of summary) {
    if (row.status in byStatus) byStatus[row.status] = row.count;
    if (EARNING_STATUSES.has(row.status)) earningsCents += row.payout;
  }

  return {
    vendor: toVendorDto(vendor),
    work: {
      byStatus,
      // Two numbers a vendor actually reads: what is waiting on them, and
      // what they have booked. Both are derived, never stored.
      openOffers: byStatus.offered,
      earningsCents,
      earningsLabel: money(earningsCents),
    },
  };
}

export type ProfilePatch = {
  businessName?: string;
  contactName?: string;
  phone?: string | null;
  website?: string | null;
  serviceArea?: string | null;
  yearsActive?: number | null;
  hasInsurance?: boolean;
  portfolioUrl?: string | null;
  bio?: string | null;
};

/**
 * The vendor edits how they are described, not what they are eligible for:
 * `serviceTypes` and `isActive` are a coordinator's decision and are not in
 * ProfilePatch, so no request body can reach them from here.
 */
export async function updateMyProfile(vendor: VendorRow, patch: ProfilePatch) {
  if (Object.keys(patch).length === 0) return toVendorDto(vendor);
  const row = await repo.updateVendor(vendor.id, patch);
  if (row === null) throw notFound("We cannot find your vendor profile.");
  return toVendorDto(row);
}

/* ------------------------------------------------------------- assignments */

export async function listMyAssignments(
  vendor: VendorRow,
  status: string | undefined,
  page: number,
  pageSize: number,
  offset: number,
) {
  const { rows, total } = await repo.listAssignmentsForVendor(vendor.id, {
    status,
    limit: pageSize,
    offset,
  });
  return { items: rows.map(toAssignmentDto), page, pageSize, total };
}

export async function getMyAssignment(vendor: VendorRow, id: string) {
  const row = await repo.findAssignmentForVendor(id, vendor.id);
  // Deliberately the same answer as an id that does not exist: a vendor
  // probing ids should not be able to tell somebody else's job from a typo.
  if (row === null) throw notFound("We cannot find that job.");
  return toAssignmentDto(row);
}

export async function respondToAssignment(
  vendor: VendorRow,
  id: string,
  action: ResponseAction,
  note: string | undefined,
) {
  const current = await repo.findAssignmentForVendor(id, vendor.id);
  if (current === null) throw notFound("We cannot find that job.");

  const rule = RESPONSES[action];
  if (!(rule.from as readonly string[]).includes(current.status)) {
    // Withdrawn by the coordinator, or already answered in another tab.
    throw conflict(
      current.status === "withdrawn"
        ? "This offer was withdrawn."
        : `This offer has already been ${current.status}.`,
      { status: current.status },
    );
  }

  const row = await repo.updateAssignment(id, {
    status: rule.to,
    responseNote: note ?? null,
    respondedAt: nowSeconds(),
  });
  if (row === null) throw notFound("We cannot find that job.");

  logger.info("vendor answered an offer", {
    assignmentId: id,
    vendorId: vendor.id,
    action,
    status: rule.to,
  });

  return getMyAssignment(vendor, id);
}

/**
 * Guards the one transition a vendor drives that is not a yes/no: marking an
 * accepted job done. The coordinator can still move it themselves, and only
 * an accepted job can be completed — nothing else has been agreed.
 */
export async function completeAssignment(vendor: VendorRow, id: string) {
  const current = await repo.findAssignmentForVendor(id, vendor.id);
  if (current === null) throw notFound("We cannot find that job.");
  if (current.status === "completed") return toAssignmentDto(current);
  if (current.status !== "accepted") {
    throw badRequest("Only a job you have accepted can be marked complete.");
  }

  await repo.updateAssignment(id, { status: "completed" });
  return getMyAssignment(vendor, id);
}
