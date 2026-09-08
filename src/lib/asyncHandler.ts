/**
 * Express 5 forwards a rejected promise from a handler to the error middleware
 * on its own, but only for the handler itself — not for a rejection raised
 * inside a nested callback. Wrapping keeps the intent explicit at every route
 * and keeps the signature typed.
 */

import type { NextFunction, Request, RequestHandler, Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export function asyncHandler(handler: Handler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
