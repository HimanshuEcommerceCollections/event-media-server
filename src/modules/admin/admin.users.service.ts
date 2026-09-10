import { query, queryOne } from "../../db/pool.js";
import { badRequest, notFound } from "../../lib/http.js";
import { nowSeconds } from "../../lib/ids.js";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  email_verified: boolean;
  created_at: number;
  last_signin_at: number | null;
};

const SELECT_COLUMNS = `
  SELECT id, email, full_name, role, email_verified, created_at, last_signin_at
    FROM users`;

function toDto(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    lastSigninAt: row.last_signin_at,
  };
}

export async function listUsers(
  search: string | undefined,
  page: number,
  pageSize: number,
  offset: number,
) {
  const where = search === undefined ? "" : "WHERE email ILIKE $3 OR full_name ILIKE $3";
  const params = search === undefined ? [pageSize, offset] : [pageSize, offset, `%${search}%`];
  const countParams = search === undefined ? [] : [`%${search}%`];

  const [rows, countRow] = await Promise.all([
    query<UserRow>(
      `${SELECT_COLUMNS} ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      params,
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::bigint AS count FROM users ${search === undefined ? "" : "WHERE email ILIKE $1 OR full_name ILIKE $1"}`,
      countParams,
    ),
  ]);

  return { items: rows.map(toDto), page, pageSize, total: countRow?.count ?? 0 };
}

export async function updateUserRole(id: string, role: string, callerId: string) {
  if (id === callerId) throw badRequest("You cannot change your own role.");

  const row = await queryOne<UserRow>(
    `UPDATE users SET role = $2, updated_at = $3 WHERE id = $1
       RETURNING id, email, full_name, role, email_verified, created_at, last_signin_at`,
    [id, role, nowSeconds()],
  );
  if (row === null) throw notFound("We cannot find a user with that id.");
  return toDto(row);
}
