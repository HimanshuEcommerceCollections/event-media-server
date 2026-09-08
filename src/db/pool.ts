/**
 * The PostgreSQL connection pool and the thin query helpers built on it.
 *
 * Everything goes through `query`/`queryOne`/`withTransaction` so no module
 * outside this file holds a client, which is what guarantees a client is
 * always released even when a handler throws.
 */

import pg from "pg";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const { Pool, types } = pg;

// node-postgres hands back BIGINT (int8) as a string to avoid losing precision
// past 2^53. Every int8 column here is a unix-second timestamp or a cent
// amount, both far inside the safe range, so parsing to a number keeps the
// repositories free of string-to-number juggling.
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));
// NUMERIC likewise arrives as a string; the only numerics here are ratings and
// stat values, which are small decimals.
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

export const pool = new Pool({
  connectionString: env.db.url,
  max: env.db.poolMax,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : undefined,
  // Fail a stuck connection attempt rather than hanging the request forever.
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

// An idle client dropped by the server (a restart, a network blip) surfaces
// here rather than on a query. Without a listener this would crash the process.
pool.on("error", (err) => {
  logger.error("idle database client errored", { error: err.message });
});

export type QueryParams = readonly unknown[];

export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params: QueryParams = [],
): Promise<T[]> {
  const result = await pool.query<T>(sql, params as unknown[]);
  return result.rows;
}

export async function queryOne<T extends pg.QueryResultRow>(
  sql: string,
  params: QueryParams = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params: QueryParams = []): Promise<number> {
  const result = await pool.query(sql, params as unknown[]);
  return result.rowCount ?? 0;
}

/**
 * Runs `fn` against a single client inside a transaction. The client is passed
 * in so every statement in the unit of work lands on the same connection —
 * using the pool directly inside a transaction would scatter statements across
 * connections and silently escape it.
 */
export async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(makeTx(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      // A failed rollback means the connection is unusable; the original error
      // is the one worth propagating.
      logger.error("transaction rollback failed", {
        error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
      });
    }
    throw err;
  } finally {
    client.release();
  }
}

export type Tx = {
  query<T extends pg.QueryResultRow>(sql: string, params?: QueryParams): Promise<T[]>;
  queryOne<T extends pg.QueryResultRow>(sql: string, params?: QueryParams): Promise<T | null>;
  execute(sql: string, params?: QueryParams): Promise<number>;
};

function makeTx(client: pg.PoolClient): Tx {
  return {
    async query<T extends pg.QueryResultRow>(sql: string, params: QueryParams = []) {
      const result = await client.query<T>(sql, params as unknown[]);
      return result.rows;
    },
    async queryOne<T extends pg.QueryResultRow>(sql: string, params: QueryParams = []) {
      const result = await client.query<T>(sql, params as unknown[]);
      return result.rows[0] ?? null;
    },
    async execute(sql: string, params: QueryParams = []) {
      const result = await client.query(sql, params as unknown[]);
      return result.rowCount ?? 0;
    },
  };
}

/**
 * Waits for Postgres to accept connections. In Compose the database container
 * is reported healthy before it has finished its first-run initialisation, so
 * the API has to be willing to retry instead of exiting.
 */
export async function waitForDatabase(): Promise<void> {
  const deadline = Date.now() + env.db.connectRetrySeconds * 1000;
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      await pool.query("SELECT 1");
      if (attempt > 1) logger.info("database reachable", { attempt });
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (Date.now() >= deadline) {
        throw new Error(`Database unreachable after ${env.db.connectRetrySeconds}s: ${message}`);
      }
      logger.warn("database not ready, retrying", { attempt, error: message });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
