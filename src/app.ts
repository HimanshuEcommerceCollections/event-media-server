/**
 * Express app assembly. Kept separate from index.ts so the app can be built
 * without opening a port.
 */

import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { ok } from "./lib/http.js";
import { resolveAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { perksRouter } from "./modules/perks/perks.routes.js";
import { contentRouter } from "./modules/content/content.routes.js";
import { requestsRouter } from "./modules/requests/requests.routes.js";
import { pool } from "./db/pool.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Behind a proxy the client IP is in X-Forwarded-For; without this every
  // request would rate-limit against the proxy's address.
  if (env.trustProxy) app.set("trust proxy", true);

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: a server-side fetch (the landing page's own render)
        // or a curl. There is no browser to protect, so let it through.
        if (!origin) return callback(null, true);
        if (env.corsOrigins.includes(origin)) return callback(null, true);
        logger.warn("blocked cross-origin request", { origin });
        return callback(null, false);
      },
      // Tokens travel in the Authorization header, not cookies, so credentials
      // stay off — which also keeps the wildcard-plus-credentials mistake out.
      credentials: false,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "authorization"],
      exposedHeaders: ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "retry-after"],
      maxAge: 86_400,
    }),
  );

  // 100kb is generous for the largest body here (a quote request with its line
  // items) and small enough that a huge payload is rejected before parsing.
  app.use(express.json({ limit: "100kb" }));

  app.use((req, _res, next) => {
    logger.debug("request", { method: req.method, path: req.path });
    next();
  });

  // Resolves a bearer token when one is present, and never rejects.
  app.use(resolveAuth);

  // A blunt ceiling for the whole API. The auth routes add their own tighter
  // limits on top.
  app.use("/api/", rateLimit({ scope: "global" }));

  app.get("/health", (_req, res) => {
    ok(res, { status: "ok", uptimeSeconds: Math.floor(process.uptime()) });
  });

  /** Reports whether the API can actually serve, which /health does not. */
  app.get("/health/ready", (_req, res, next) => {
    pool
      .query("SELECT 1")
      .then(() => ok(res, { status: "ready", database: "up" }))
      .catch(() => {
        res.status(503).json({
          error: { code: "not_ready", message: "The database is not reachable." },
        });
      })
      .catch(next);
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/perks", perksRouter);
  app.use("/api/v1/content", contentRouter);
  app.use("/api/v1/requests", requestsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
