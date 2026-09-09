/**
 * EVM-2026-0001 — the reference a visitor is given and quotes back.
 *
 * Sequential per year and per kind, so the number says roughly when it was
 * raised. The counter is bumped by one atomic statement: two requests landing
 * together take two values rather than racing for the same one.
 */

import { queryOne } from "../../db/pool.js";
import type { Tx } from "../../db/pool.js";

export async function nextReference(kind: "EVM" | "EVV", tx?: Tx): Promise<string> {
  const year = new Date().getUTCFullYear();
  const sql = `INSERT INTO reference_counters (kind, year, next_value)
               VALUES ($1, $2, 1)
               ON CONFLICT (kind, year)
               DO UPDATE SET next_value = reference_counters.next_value + 1
               RETURNING next_value`;

  const row =
    tx === undefined
      ? await queryOne<{ next_value: number }>(sql, [kind, year])
      : ((await tx.query<{ next_value: number }>(sql, [kind, year]))[0] ?? null);

  if (row === null) throw new Error(`reference counter for ${kind}/${year} returned no row`);

  // Four digits is the documented shape; past 9,999 in one year the number
  // grows rather than wrapping onto a reference already given out.
  return `${kind}-${year}-${String(row.next_value).padStart(4, "0")}`;
}
