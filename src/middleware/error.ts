/**
 * The single place a response body for a failure is written.
 *
 * An AppError is deliberate and its message is safe to show a user. Anything
 * else is a bug: it is logged with its stack and answered with a generic 500,
 * so an internal message (a SQL string, a file path) never reaches a client.
 */

import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: "not_found", message: `No route for ${req.method} ${req.path}.` },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Express can reach the error handler after headers are already out (a
  // failure part-way through a stream). Nothing can be sent then.
  if (res.headersSent) return;

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error(err.message, { code: err.code, path: req.path });
    } else {
      logger.debug("request rejected", { code: err.code, status: err.status, path: req.path });
    }
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // express.json() rejects a malformed body with a SyntaxError carrying a
  // status; that is the client's mistake, not a server fault.
  if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      error: { code: "bad_request", message: "Request body is not valid JSON." },
    });
    return;
  }

  logger.error("unhandled error", {
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: "internal_error",
      message: "Something went wrong on our side. Please try again.",
      // The real message is useful while developing and a leak in production.
      ...(env.isProd ? {} : { details: { reason: err instanceof Error ? err.message : String(err) } }),
    },
  });
};
