/**
 * A fixed-window limiter, in memory.
 *
 * TRADEOFF: the counters live in this process, so two API containers each
 * allow the full budget and a restart forgets everything. It is enough to blunt
 * a password-guessing loop from one address, which is what the auth endpoints
 * need here; a shared store (Redis) is the replacement once there is more than
 * one instance.
 */

import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { tooManyRequests } from "../lib/http.js";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Without this the map grows one entry per address seen, forever.
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000);
sweeper.unref();

export function rateLimit(options?: { max?: number; windowSeconds?: number; scope?: string }): RequestHandler {
  // A full run of the API test suite (backend/postman) makes more calls in a
  // minute than any real client would, and several of its budgets are per
  // route rather than global, so there is no single number to raise. This is
  // the one switch that makes the suite re-runnable; it cannot take effect in
  // production.
  if (env.rateLimit.disabled) return (_req, _res, next) => next();

  const max = options?.max ?? env.rateLimit.maxRequests;
  const windowMs = (options?.windowSeconds ?? env.rateLimit.windowSeconds) * 1000;
  const scope = options?.scope ?? "default";

  return (req, res, next) => {
    const key = `${scope}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      setHeaders(res, max, max - 1, now + windowMs);
      next();
      return;
    }

    existing.count++;
    const remaining = Math.max(0, max - existing.count);
    setHeaders(res, max, remaining, existing.resetAt);

    if (existing.count > max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("retry-after", String(retryAfter));
      next(tooManyRequests("Too many attempts. Please wait a moment and try again.", retryAfter));
      return;
    }

    next();
  };
}

function setHeaders(
  res: Parameters<RequestHandler>[1],
  limit: number,
  remaining: number,
  resetAt: number,
): void {
  res.setHeader("ratelimit-limit", String(limit));
  res.setHeader("ratelimit-remaining", String(remaining));
  res.setHeader("ratelimit-reset", String(Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))));
}
