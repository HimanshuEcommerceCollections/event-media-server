/**
 * Access and refresh tokens.
 *
 * Both are JWTs. The refresh token additionally carries a `sid` naming a row
 * in the sessions table, so signing out (or a stolen token being replayed
 * after rotation) can be made to fail server-side — a JWT alone cannot be
 * revoked.
 */

import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { unauthorized } from "./http.js";

export type AccessClaims = { sub: string; email: string; role: string; typ: "access" };
export type RefreshClaims = { sub: string; sid: string; typ: "refresh" };

const base = { issuer: env.jwt.issuer, audience: env.jwt.audience } as const;

export function signAccessToken(userId: string, email: string, role: string): string {
  const payload: AccessClaims = { sub: userId, email, role, typ: "access" };
  return jwt.sign(payload, env.jwt.accessSecret, {
    ...base,
    expiresIn: env.jwt.accessTtlSeconds,
  });
}

export function signRefreshToken(userId: string, sessionId: string, remember: boolean): string {
  const payload: RefreshClaims = { sub: userId, sid: sessionId, typ: "refresh" };
  return jwt.sign(payload, env.jwt.refreshSecret, {
    ...base,
    expiresIn: remember ? env.jwt.refreshTtlRememberSeconds : env.jwt.refreshTtlSeconds,
  });
}

function verify<T>(token: string, secret: string, typ: string): T {
  let claims: unknown;
  try {
    claims = jwt.verify(token, secret, { ...base, algorithms: ["HS256"] });
  } catch (cause) {
    if (cause instanceof jwt.TokenExpiredError) {
      throw unauthorized("Your session has expired. Please sign in again.");
    }
    throw unauthorized("That session is not valid.");
  }
  if (typeof claims !== "object" || claims === null) throw unauthorized("That session is not valid.");
  // An access token must not be accepted where a refresh token is expected,
  // even though both are signed by this service.
  if ((claims as { typ?: unknown }).typ !== typ) throw unauthorized("That session is not valid.");
  return claims as T;
}

export const verifyAccessToken = (token: string): AccessClaims =>
  verify<AccessClaims>(token, env.jwt.accessSecret, "access");

export const verifyRefreshToken = (token: string): RefreshClaims =>
  verify<RefreshClaims>(token, env.jwt.refreshSecret, "refresh");

/** Pulls the token out of `Authorization: Bearer <token>`. */
export function bearerFrom(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token === "" ? null : token;
}
