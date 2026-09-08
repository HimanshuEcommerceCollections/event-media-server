/**
 * Request fields this app adds.
 *
 * `validatedQuery` / `validatedParams` exist because Express 5 makes req.query
 * a getter, so assigning a parsed value back onto it throws.
 */

declare global {
  namespace Express {
    interface Request {
      /** Set by resolveAuth when a valid bearer token is present. */
      auth?: { userId: string; email: string };
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
