import { query, queryOne } from "../../db/pool.js";
import { nowSeconds } from "../../lib/ids.js";

const BOOKING_STATUSES = ["new", "confirmed", "in_progress", "completed", "cancelled"] as const;
const VENDOR_STATUSES = ["new", "reviewing", "approved", "rejected"] as const;

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

function byStatus(
  rows: { status: string; count: number }[],
  statuses: readonly string[],
): { byStatus: Record<string, number>; total: number } {
  const map = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<string, number>;
  let total = 0;
  for (const row of rows) {
    if (row.status in map) map[row.status] = row.count;
    total += row.count;
  }
  return { byStatus: map, total };
}

const ASSIGNMENT_STATUSES = ["offered", "accepted", "declined", "withdrawn", "completed"] as const;

export async function getSummary() {
  const [bookingRows, vendorRows, userCount, analyticsRows, assignmentRows, vendorAccountRow] =
    await Promise.all([
      query<{ status: string; count: number }>(
        "SELECT status, COUNT(*)::bigint AS count FROM event_booking_requests GROUP BY status",
      ),
      query<{ status: string; count: number }>(
        "SELECT status, COUNT(*)::bigint AS count FROM vendor_applications GROUP BY status",
      ),
      queryOne<{ count: number }>("SELECT COUNT(*)::bigint AS count FROM users"),
      query<{ name: string; count: number }>(
        `SELECT name, COUNT(*)::bigint AS count FROM analytics_events
          WHERE created_at >= $1
          GROUP BY name
          ORDER BY count DESC`,
        [nowSeconds() - SEVEN_DAYS_SECONDS],
      ),
      query<{ status: string; count: number }>(
        "SELECT status, COUNT(*)::bigint AS count FROM booking_assignments GROUP BY status",
      ),
      queryOne<{ total: number; active: number }>(
        `SELECT COUNT(*)::bigint AS total,
                COUNT(*) FILTER (WHERE is_active)::bigint AS active
           FROM vendors`,
      ),
    ]);

  return {
    bookings: byStatus(bookingRows, BOOKING_STATUSES),
    vendors: byStatus(vendorRows, VENDOR_STATUSES),
    users: { total: userCount?.count ?? 0 },
    // The live side of the vendor flow, as opposed to `vendors` above, which
    // counts applications: accounts that exist, and work waiting on them.
    vendorAccounts: {
      total: vendorAccountRow?.total ?? 0,
      active: vendorAccountRow?.active ?? 0,
    },
    assignments: byStatus(assignmentRows, ASSIGNMENT_STATUSES),
    analyticsLast7d: analyticsRows.map((r) => ({ name: r.name, count: r.count })),
  };
}
