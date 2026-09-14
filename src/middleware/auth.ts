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
import { forbidden, unauthorized } from "../lib/http.js";
import { findVendorByUserId } from "../modules/vendors/vendors.repo.js";

export const resolveAuth: RequestHandler = (req, _res, next) => {
  const token = bearerFrom(req.headers.authorization);
  if (token === null) {
    next();
    return;
  }
  try {
    const claims = verifyAccessToken(token);
    req.auth = { userId: claims.sub, email: claims.email, role: claims.role };
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

/**
 * For admin-only endpoints. Must run after requireAuth: it trusts req.auth to
 * already be set and only checks the role carried in it.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== "admin") {
    next(forbidden());
    return;
  }
  next();
};

/**
 * For the vendor portal. Must run after requireAuth.
 *
 * Unlike requireAdmin this asks the database rather than the token: the role
 * on an access token is whatever it was when the token was minted, and a
 * customer who is approved as a vendor mid-session would otherwise be locked
 * out of their own dashboard until the token expired. The vendor profile is
 * the authority on whether somebody can act as a vendor, so it is also what
 * the guard loads — and the handlers below it get it for free on req.vendor.
 */
export const requireVendor: RequestHandler = (req, _res, next) => {
  if (!req.auth) {
    next(unauthorized());
    return;
  }
  findVendorByUserId(req.auth.userId)
    .then((vendor) => {
      if (vendor === null) {
        next(forbidden("This account is not set up as a vendor."));
        return;
      }
      if (!vendor.is_active) {
        next(forbidden("This vendor account is suspended. Talk to your coordinator."));
        return;
      }
      req.vendor = vendor;
      next();
    })
    .catch(next);
};
