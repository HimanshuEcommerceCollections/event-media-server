/**
 * Vendor applications from the coordinator's side.
 *
 * Moving one to "approved" is not just a status: it provisions the account
 * the applicant signs into (see admin.vendors.provision.ts), which is what
 * makes approval the end of the application flow and the start of the vendor
 * one. Every other transition is only a label.
 */

import { query, queryOne } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { nowSeconds } from "../../lib/ids.js";
import { provisionVendorAccount } from "./admin.vendors.provision.js";

type VendorApplicationRow = {
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
  updated_at: number;
  /** The vendor profile this application became, once approved. */
  vendor_id: string | null;
};

// The LEFT JOIN is what lets a row say "this one already has an account"
// without a second round trip per application.
const SELECT_COLUMNS = `
  SELECT a.id, a.reference, a.business_name, a.contact_name, a.email, a.phone, a.website,
         a.service_types, a.years_active, a.service_area, a.has_insurance, a.part107,
         a.portfolio_url, a.notes, a.status, a.created_at, a.updated_at,
         v.id AS vendor_id
    FROM vendor_applications a
    LEFT JOIN vendors v ON v.application_id = a.id`;

function toDto(row: VendorApplicationRow) {
  return {
    id: row.id,
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
    part107: row.part107,
    portfolioUrl: row.portfolio_url,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    vendorId: row.vendor_id,
  };
}

export async function listVendors(status: string | undefined, page: number, pageSize: number, offset: number) {
  const where = status === undefined ? "" : "WHERE a.status = $3";
  const params = status === undefined ? [pageSize, offset] : [pageSize, offset, status];
  const countParams = status === undefined ? [] : [status];

  const [rows, countRow] = await Promise.all([
    query<VendorApplicationRow>(
      `${SELECT_COLUMNS} ${where} ORDER BY a.created_at DESC LIMIT $1 OFFSET $2`,
      params,
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::bigint AS count FROM vendor_applications ${status === undefined ? "" : "WHERE status = $1"}`,
      countParams,
    ),
  ]);

  return { items: rows.map(toDto), page, pageSize, total: countRow?.count ?? 0 };
}

export async function getVendor(id: string) {
  const row = await queryOne<VendorApplicationRow>(`${SELECT_COLUMNS} WHERE a.id = $1`, [id]);
  if (row === null) throw notFound("We cannot find a vendor application with that id.");
  return toDto(row);
}

export async function updateVendorStatus(id: string, status: string) {
  const updated = await queryOne<{ id: string }>(
    "UPDATE vendor_applications SET status = $2, updated_at = $3 WHERE id = $1 RETURNING id",
    [id, status, nowSeconds()],
  );
  if (updated === null) throw notFound("We cannot find a vendor application with that id.");

  let account: { vendorId: string; accountCreated: boolean; inviteSent: boolean } | null = null;

  if (status === "approved") {
    // Read back through getVendor rather than the UPDATE's RETURNING: the row
    // has to carry the service types and contact details the profile is built
    // from, and provisioning is idempotent so a re-approval is a no-op.
    const application = await queryOne<{
      id: string;
      business_name: string;
      contact_name: string;
      email: string;
      phone: string | null;
      website: string | null;
      service_types: string[];
      years_active: number | null;
      service_area: string | null;
      has_insurance: boolean;
      portfolio_url: string | null;
    }>(
      `SELECT id, business_name, contact_name, email, phone, website, service_types,
              years_active, service_area, has_insurance, portfolio_url
         FROM vendor_applications WHERE id = $1`,
      [id],
    );
    if (application !== null) {
      const result = await provisionVendorAccount(application);
      account = {
        vendorId: result.vendor.id,
        accountCreated: result.accountCreated,
        inviteSent: result.inviteSent,
      };
    }
  }

  return { ...(await getVendor(id)), account };
}
