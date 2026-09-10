/**
 * A small CRUD factory for the admin API's "generic content resource" tables
 * (content_pages, legal_documents, gallery_items, featured_events, categories,
 * stats, testimonials, reviews).
 *
 * Every one of these is: one table, one primary key column, a fixed list of
 * columns, camelCase DTOs that are a mechanical rename of the snake_case
 * columns, and JSON columns that need a ::jsonb cast on write (node-postgres
 * already parses jsonb back into objects on read, so nothing special is
 * needed there). Writing this once instead of eight near-identical repo files
 * means a column rename or a new resource is one config object, not a new
 * file.
 */

import { execute, query, queryOne } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { newId, nowSeconds } from "../../lib/ids.js";

type Row = Record<string, unknown>;

/** snake_case column -> camelCase DTO key. */
export const toCamelKey = (s: string): string => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** camelCase DTO key -> snake_case column. */
export const toSnakeKey = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function rowToDto(row: Row): Record<string, unknown> {
  const dto: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) dto[toCamelKey(key)] = value;
  return dto;
}

export type TableResourceConfig = {
  table: string;
  /** The column that is the primary key. Its DTO name is toCamelKey(pk). */
  pk: string;
  /** Every snake_case column to select/write, including the pk. */
  columns: string[];
  /** Subset of `columns` that are JSONB and need a ::jsonb cast on write. */
  jsonColumns?: string[];
  /** Defaults to the pk column. */
  orderBy?: string;
  /**
   * When set, the pk is server-generated via newId(idPrefix) on create rather
   * than accepted from the request body — for tables whose pk is a plain
   * `id` (gallery_items, testimonials) rather than a caller-chosen slug/key.
   */
  idPrefix?: string;
  /**
   * Columns always stamped with the current time on create *and* update,
   * overriding anything the caller sent — for the two tables (content_pages,
   * legal_documents) whose updated_at has no database default.
   */
  timestampColumns?: string[];
};

export function tableResource(config: TableResourceConfig) {
  const { table, pk, columns, orderBy = pk, idPrefix } = config;
  const jsonColumns = new Set(config.jsonColumns ?? []);
  const timestampColumns = new Set(config.timestampColumns ?? []);
  const selectCols = columns.join(", ");

  const valueFor = (col: string, raw: unknown): { value: unknown; placeholder: (i: number) => string } => {
    if (jsonColumns.has(col)) {
      return {
        value: raw === undefined || raw === null ? null : JSON.stringify(raw),
        placeholder: (i) => `$${i}::jsonb`,
      };
    }
    return { value: raw ?? null, placeholder: (i) => `$${i}` };
  };

  async function list(page: number, pageSize: number, offset: number) {
    const [rows, countRow] = await Promise.all([
      query<Row>(`SELECT ${selectCols} FROM ${table} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`, [
        pageSize,
        offset,
      ]),
      queryOne<{ count: number }>(`SELECT COUNT(*)::bigint AS count FROM ${table}`),
    ]);
    return { items: rows.map(rowToDto), page, pageSize, total: countRow?.count ?? 0 };
  }

  async function get(id: string) {
    const row = await queryOne<Row>(`SELECT ${selectCols} FROM ${table} WHERE ${pk} = $1`, [id]);
    if (row === null) throw notFound(`No matching ${table} row.`);
    return rowToDto(row);
  }

  async function create(input: Record<string, unknown>) {
    const cols: string[] = [];
    const values: unknown[] = [];
    const placeholders: string[] = [];

    const push = (col: string, raw: unknown) => {
      const { value, placeholder } = valueFor(col, raw);
      cols.push(col);
      values.push(value);
      placeholders.push(placeholder(values.length));
    };

    if (idPrefix !== undefined) push(pk, newId(idPrefix));

    for (const col of columns) {
      if (col === pk && idPrefix !== undefined) continue;
      if (timestampColumns.has(col)) {
        push(col, nowSeconds());
        continue;
      }
      const key = toCamelKey(col);
      if (!(key in input)) continue;
      push(col, input[key]);
    }

    const row = await queryOne<Row>(
      `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING ${selectCols}`,
      values,
    );
    if (row === null) throw new Error(`insert into ${table} returned no row`);
    return rowToDto(row);
  }

  async function update(id: string, input: Record<string, unknown>) {
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const col of columns) {
      if (col === pk) continue;
      const isTimestamp = timestampColumns.has(col);
      const key = toCamelKey(col);
      if (!isTimestamp && !(key in input)) continue;
      const raw = isTimestamp ? nowSeconds() : input[key];
      const { value, placeholder } = valueFor(col, raw);
      values.push(value);
      sets.push(`${col} = ${placeholder(values.length)}`);
    }

    if (sets.length === 0) return get(id);

    values.push(id);
    const row = await queryOne<Row>(
      `UPDATE ${table} SET ${sets.join(", ")} WHERE ${pk} = $${values.length} RETURNING ${selectCols}`,
      values,
    );
    if (row === null) throw notFound(`No matching ${table} row.`);
    return rowToDto(row);
  }

  async function remove(id: string) {
    const count = await execute(`DELETE FROM ${table} WHERE ${pk} = $1`, [id]);
    if (count === 0) throw notFound(`No matching ${table} row.`);
  }

  return { list, get, create, update, remove };
}
