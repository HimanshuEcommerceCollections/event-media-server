/**
 * The s-maxage header the public content routes share.
 *
 * Lifted out of content.routes.ts once a second router needed it — Next's own
 * revalidation window should not be the only cache in play.
 */

import type { RequestHandler } from "express";

export const cacheable = (seconds: number): RequestHandler => (_req, res, next) => {
  res.setHeader("cache-control", `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=300`);
  next();
};
