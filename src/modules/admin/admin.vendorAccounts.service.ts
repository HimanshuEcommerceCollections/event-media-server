/**
 * The vendor directory: the accounts that approved applications became.
 *
 * Separate from admin.vendors.service.ts, which is about applications. The
 * two read almost the same fields and mean different things — an application
 * records what was claimed at one moment, a vendor is a live profile that
 * both the vendor and the coordinator edit afterwards — so they do not share
 * a DTO.
 */

import { query, queryOne } from "../../db/pool.js";
import { badRequest, notFound } from "../../lib/http.js";
import { money } from "../pricing/pricing.engine.js";
import * as vendorRepo from "../vendors/vendors.repo.js";
import { toVendorDto } from "../vendors/vendors.portal.service.js";

/** Payout only counts once the vendor is on the hook for the work. */
const EARNING_STATUSES = new Set(["accepted", "completed"]);

export async function listVendorAccounts(opts: {
  serviceType?: string;
  includeInactive: boolean;
  page: number;
  pageSize: number;
  offset: number;
}) {
  const { rows, total } = await vendorRepo.listVendors({
    serviceType: opts.serviceType,
    includeInactive: opts.includeInactive,
    limit: opts.pageSize,
    offset: opts.offset,
  });

  if (rows.length === 0) {
    return { items: [], page: opts.page, pageSize: opts.pageSize, total };
  }

  // One grouped query for the whole page rather than a summary call per row:
  // the directory is the picker behind every offer and is read constantly.
  const counts = await query<{ vendor_id: string; open_offers: number; accepted: number }>(
    `SELECT vendor_id,
            COUNT(*) FILTER (WHERE status = 'offered')::bigint  AS open_offers,
            COUNT(*) FILTER (WHERE status IN ('accepted', 'completed'))::bigint AS accepted
       FROM booking_assignments
      WHERE vendor_id = ANY($1)
      GROUP BY vendor_id`,
    [rows.map((r) => r.id)],
  );
  const byVendor = new Map(counts.map((c) => [c.vendor_id, c]));

  return {
    items: rows.map((row) => ({
      ...toVendorDto(row),
      openOffers: byVendor.get(row.id)?.open_offers ?? 0,
      acceptedJobs: byVendor.get(row.id)?.accepted ?? 0,
    })),
    page: opts.page,
    pageSize: opts.pageSize,
    total,
  };
}

export async function getVendorAccount(id: string) {
  const row = await vendorRepo.findVendorById(id);
  if (row === null) throw notFound("We cannot find a vendor with that id.");

  const [summary, user] = await Promise.all([
    vendorRepo.summariseVendorWork(id),
    queryOne<{ email: string; role: string; last_signin_at: number | null }>(
      "SELECT email, role, last_signin_at FROM users WHERE id = $1",
      [row.user_id],
    ),
  ]);

  const byStatus: Record<string, number> = {
    offered: 0,
    accepted: 0,
    declined: 0,
    withdrawn: 0,
    completed: 0,
  };
  let payoutCents = 0;
  for (const entry of summary) {
    if (entry.status in byStatus) byStatus[entry.status] = entry.count;
    if (EARNING_STATUSES.has(entry.status)) payoutCents += entry.payout;
  }

  return {
    ...toVendorDto(row),
    // Whether the invite was ever taken up is the question a coordinator
    // chasing a silent vendor actually has.
    account: {
      userId: row.user_id,
      email: user?.email ?? row.email,
      role: user?.role ?? null,
      lastSigninAt: user?.last_signin_at ?? null,
      hasSignedIn: (user?.last_signin_at ?? null) !== null,
    },
    work: { byStatus, payoutCents, payoutLabel: money(payoutCents) },
  };
}

export async function updateVendorAccount(
  id: string,
  patch: {
    businessName?: string;
    contactName?: string;
    phone?: string | null;
    serviceArea?: string | null;
    serviceTypes?: string[];
    isActive?: boolean;
  },
) {
  if (patch.serviceTypes !== undefined) {
    // A vendor listed for a service that does not exist can never be offered
    // anything, and the mistake would only show up as an empty picker.
    const known = new Set(
      (await query<{ slug: string }>("SELECT slug FROM services WHERE is_active")).map((r) => r.slug),
    );
    const unknown = patch.serviceTypes.filter((slug) => !known.has(slug));
    if (unknown.length > 0) throw badRequest(`We do not list a service called "${unknown[0]}".`);
  }

  const row = await vendorRepo.updateVendor(id, patch);
  if (row === null) throw notFound("We cannot find a vendor with that id.");
  return getVendorAccount(row.id);
}
