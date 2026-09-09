/**
 * Vendor applications.
 *
 * The drone service is the only one that asks for Part-107 details, and it
 * asks for them because a coordinator needs to see them — not because anything
 * here verifies them. `part107` is stored exactly as typed and is never read
 * as proof of certification.
 */

import { query, queryOne, withTransaction } from "../../db/pool.js";
import { badRequest, notFound } from "../../lib/http.js";
import { newId, nowSeconds } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { nextReference } from "../bookings/bookings.reference.js";
import type { ApplicationInput } from "./vendors.routes.js";

const DRONE_SLUG = "drone-video";

type ApplicationRow = {
  id: string;
  reference: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  service_types: string[];
  years_active: number | null;
  service_area: string | null;
  has_insurance: boolean;
  part107: Record<string, unknown> | null;
  portfolio_url: string | null;
  notes: string | null;
  status: string;
  created_at: number;
};

export async function listServiceTypes() {
  const rows = await query<{ slug: string; title: string; blurb: string; is_b2b: boolean }>(
    "SELECT slug, title, blurb, is_b2b FROM services WHERE is_active ORDER BY sort_order",
  );
  return rows.map((row) => ({
    key: row.slug,
    label: row.title,
    blurb: row.blurb,
    isB2b: row.is_b2b,
    // The form reveals the Part-107 fields when a service says to.
    requiresPart107: row.slug === DRONE_SLUG,
  }));
}

export async function createApplication(input: ApplicationInput, userId: string | null) {
  const known = new Set(
    (await query<{ slug: string }>("SELECT slug FROM services WHERE is_active")).map((r) => r.slug),
  );
  const unknown = input.serviceTypes.filter((slug) => !known.has(slug));
  if (unknown.length > 0) throw badRequest(`We do not list a service called "${unknown[0]}".`);

  const flying = input.serviceTypes.includes(DRONE_SLUG);
  if (flying && input.part107 === undefined) {
    throw badRequest("Drone work needs your Part-107 certificate number.");
  }
  // Dropped rather than stored against a vendor who does not fly: it would sit
  // in the record with nothing to explain why it is there.
  const part107 = flying ? (input.part107 ?? null) : null;

  const row = await withTransaction(async (tx) => {
    const reference = await nextReference("EVV", tx);
    const rows = await tx.query<ApplicationRow>(
      `INSERT INTO vendor_applications
         (id, reference, user_id, business_name, contact_name, email, phone, website,
          service_types, years_active, service_area, has_insurance, part107,
          portfolio_url, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16)
       RETURNING id, reference, business_name, contact_name, email, phone, website,
                 service_types, years_active, service_area, has_insurance, part107,
                 portfolio_url, notes, status, created_at`,
      [
        newId("ven"),
        reference,
        userId,
        input.businessName,
        input.contactName,
        input.email,
        input.phone ?? null,
        input.website ?? null,
        JSON.stringify(input.serviceTypes),
        input.yearsActive ?? null,
        input.serviceArea ?? null,
        input.hasInsurance,
        part107 === null ? null : JSON.stringify(part107),
        input.portfolioUrl ?? null,
        input.notes ?? null,
        nowSeconds(),
      ],
    );
    return rows[0] ?? null;
  });

  if (row === null) throw new Error("createApplication returned no row");

  logger.info("vendor application received", {
    reference: row.reference,
    serviceTypes: input.serviceTypes,
  });

  return toDto(row);
}

export async function getApplication(reference: string) {
  const row = await queryOne<ApplicationRow>(
    `SELECT id, reference, business_name, contact_name, email, phone, website,
            service_types, years_active, service_area, has_insurance, part107,
            portfolio_url, notes, status, created_at
       FROM vendor_applications WHERE reference = $1`,
    [reference.toUpperCase()],
  );
  if (row === null) throw notFound("We cannot find an application with that reference.");
  return toDto(row);
}

function toDto(row: ApplicationRow) {
  return {
    reference: row.reference,
    businessName: row.business_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    website: row.website,
    serviceTypes: row.service_types,
    yearsActive: row.years_active,
    serviceArea: row.service_area,
    hasInsurance: row.has_insurance,
    // Echoed back as submitted, with the same caveat the column carries: this
    // is what the applicant typed, not something that has been checked.
    part107: row.part107 === null ? null : { ...row.part107, verified: false },
    portfolioUrl: row.portfolio_url,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}
