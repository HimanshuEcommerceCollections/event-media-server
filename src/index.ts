/**
 * Server entry point.
 *
 * Boot order matters: refuse to start on weak production secrets, wait for
 * Postgres, migrate, seed the content tables if they are empty, and only then
 * listen — so the first request never lands on a half-ready database.
 */

import { createApp } from "./app.js";
import { assertProductionSecrets, env } from "./config/env.js";
import { closeDatabase, waitForDatabase } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { seedIfEmpty } from "./db/seed.js";
import { logger } from "./lib/logger.js";

async function main(): Promise<void> {
  assertProductionSecrets();

  await waitForDatabase();
  await runMigrations();
  await seedIfEmpty();

  // Loud, because a limiter that is silently off is a limiter nobody notices
  // is off.
  if (env.rateLimit.disabled) {
    logger.warn("rate limiting is DISABLED - RATE_LIMIT_DISABLED is set (development only)");
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info("api listening", {
      port: env.port,
      env: env.nodeEnv,
      cors: env.corsOrigins.join(", "),
      devCodes: env.exposeDevCodes,
    });
  });

  // Stop accepting connections, let in-flight requests finish, then close the
  // pool. Without this, Compose's SIGTERM kills open transactions.
  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info("shutting down", { signal });

    const forced = setTimeout(() => {
      logger.warn("forcing exit: connections did not close in time");
      process.exit(1);
    }, 10_000);
    forced.unref();

    server.close(() => {
      void closeDatabase()
        .catch((err: unknown) => {
          logger.error("failed to close the database pool", {
            error: err instanceof Error ? err.message : String(err),
          });
        })
        .finally(() => {
          clearTimeout(forced);
          process.exit(0);
        });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  logger.error("failed to start", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
