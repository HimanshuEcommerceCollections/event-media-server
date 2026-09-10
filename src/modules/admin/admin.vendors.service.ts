import { query, queryOne } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { nowSeconds } from "../../lib/ids.js";

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
};

const SELECT_COLUMNS = `
  SELECT id, reference, business_name, contact_name, email, phone, website,
         service_types, years_active, service_area, has_insurance, part107,
         portfolio_url, notes, status, created_at, updated_at
    FROM vendor_applications`;

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
  };
}

export async function listVendors(status: string | undefined, page: number, pageSize: number, offset: number) {
  const where = status === undefined ? "" : "WHERE status = $3";
  const params = status === undefined ? [pageSize, offset] : [pageSize, offset, status];
  const countParams = status === undefined ? [] : [status];

  const [rows, countRow] = await Promise.all([
    query<VendorApplicationRow>(
      `${SELECT_COLUMNS} ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
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
  const row = await queryOne<VendorApplicationRow>(`${SELECT_COLUMNS} WHERE id = $1`, [id]);
  if (row === null) throw notFound("We cannot find a vendor application with that id.");
  return toDto(row);
}

export async function updateVendorStatus(id: string, status: string) {
  const row = await queryOne<VendorApplicationRow>(
    `UPDATE vendor_applications SET status = $2, updated_at = $3 WHERE id = $1 RETURNING
       id, reference, business_name, contact_name, email, phone, website,
       service_types, years_active, service_area, has_insurance, part107,
       portfolio_url, notes, status, created_at, updated_at`,
    [id, status, nowSeconds()],
  );
  if (row === null) throw notFound("We cannot find a vendor application with that id.");
  return toDto(row);
}
