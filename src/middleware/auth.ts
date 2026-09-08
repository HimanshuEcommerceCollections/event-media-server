/**
 * Bearer-token resolution.
 *
 * `resolveAuth` is mounted globally and never rejects: a missing or expired
 * token simply leaves req.auth unset. No page route is gated behind a sign-in,
 * and no role check exists yet — every content endpoint is public, and the
 * only endpoints that ask for an identity are the ones that would have nothing
 * to return without one (`/auth/me`, `/perks/me`).
 */

import type { RequestHandler } from "express";
import { bearerFrom, verifyAccessToken } from "../lib/tokens.js";
import { unauthorized } from "../lib/http.js";

export const resolveAuth: RequestHandler = (req, _res, next) => {
  const token = bearerFrom(req.headers.authorization);
  if (token === null) {
    next();
    return;
  }
  try {
    const claims = verifyAccessToken(token);
    req.auth = { userId: claims.sub, email: claims.email };
  } catch {
    // A bad token is treated as no token. The endpoints that need an identity
    // answer 401 themselves, so a stale token in storage cannot make an
    // otherwise public request fail.
  }
  next();
};

/** For endpoints whose whole answer is "yours": they need to know who asked. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(unauthorized());
    return;
  }
  next();
};
