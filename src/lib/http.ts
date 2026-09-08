/**
 * The response envelope every route uses.
 *
 * Success: { data }. Failure: { error: { code, message, details? } }. The
 * frontend's lib/api.js unwraps exactly this shape, so routes never write to
 * res directly — they return through ok() or throw an AppError.
 */

import type { Response } from "express";

export type FieldError = { field: string; message: string };

/** Anything JSON-serialisable that a client can act on. */
export type ErrorDetails = FieldError[] | Record<string, unknown>;

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetails | undefined;

  constructor(status: number, code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: ErrorDetails) =>
  new AppError(400, "bad_request", message, details);

export const unauthorized = (message = "Please sign in to continue.") =>
  new AppError(401, "unauthorized", message);

export const forbidden = (message = "You do not have access to that.") =>
  new AppError(403, "forbidden", message);

export const notFound = (message = "Not found.") => new AppError(404, "not_found", message);

export const conflict = (message: string, details?: ErrorDetails) =>
  new AppError(409, "conflict", message, details);

export const invalidCredentials = (message = "Email or password is incorrect.") =>
  new AppError(401, "invalid_credentials", message);

/** 422 carries per-field detail; the sign-in form paints these onto inputs. */
export const validationFailed = (fields: FieldError[], message = "Please check the form.") =>
  new AppError(422, "validation_failed", message, fields);

export const tooManyRequests = (message: string, retryAfterSeconds: number) =>
  new AppError(429, "too_many_requests", message, { retryAfterSeconds });

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}

export function noContent(res: Response): void {
  res.status(204).end();
}
