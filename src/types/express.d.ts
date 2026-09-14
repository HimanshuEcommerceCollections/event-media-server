/**
 * Request fields this app adds.
 *
 * `validatedQuery` / `validatedParams` exist because Express 5 makes req.query
 * a getter, so assigning a parsed value back onto it throws.
 */

import type { VendorRow } from "../modules/vendors/vendors.repo.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by resolveAuth when a valid bearer token is present. */
      auth?: { userId: string; email: string; role: string };
      /** Set by requireVendor: the caller's live vendor profile. */
      vendor?: VendorRow;
      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
