/**
 * Migration runner.
 *
 * Files in ./migrations are applied in filename order and recorded in
 * schema_migrations, so each runs exactly once. Every file runs inside one
 * transaction — a half-applied migration is worse than a failed boot.
 *
 * Two API containers starting together would otherwise race here, so the
 * runner takes a Postgres advisory lock first; the second waits, then finds
 * nothing left to apply.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { pool, withTransaction } from "./pool.js";
import { logger } from "../lib/logger.js";

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const LOCK_KEY = 8_472_100_001;

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        TEXT PRIMARY KEY,
    checksum    TEXT NOT NULL,
    applied_at  BIGINT NOT NULL
  )
`;

export async function runMigrations(): Promise<void> {
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) {
    logger.warn("no migration files found", { dir: MIGRATIONS_DIR });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(LEDGER);
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      const { rows } = await client.query<{ name: string; checksum: string }>(
        "SELECT name, checksum FROM schema_migrations",
      );
      const applied = new Map(rows.map((r) => [r.name, r.checksum]));

      for (const name of files) {
        const sql = await readFile(join(MIGRATIONS_DIR, name), "utf8");
        const checksum = createHash("sha256").update(sql).digest("hex");
        const seen = applied.get(name);

        if (seen !== undefined) {
          // An edited migration would mean this database and a fresh one no
          // longer agree on their schema. Say so loudly rather than skipping.
          if (seen !== checksum) {
            throw new Error(
              `Migration ${name} has changed since it was applied. ` +
                "Add a new migration instead of editing one that has run.",
            );
          }
          continue;
        }

        logger.info("applying migration", { name });
        await withTransaction(async (tx) => {
          await tx.execute(sql);
          await tx.execute(
            "INSERT INTO schema_migrations (name, checksum, applied_at) VALUES ($1, $2, $3)",
            [name, checksum, Math.floor(Date.now() / 1000)],
          );
        });
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
