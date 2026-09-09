/**
 * POST /api/v1/bookings/quote        — price a package, store nothing
 * POST /api/v1/bookings              — submit the one consolidated request
 * GET  /api/v1/bookings/mine         — the requests on this account
 * GET  /api/v1/bookings/:reference   — the success page, reloadable
 *
 * Submitting is open to visitors: the builder is the first thing anyone
 * touches and requiring an account first would lose the request. A token is
 * attached to the row when one is sent, so a signed-in visitor keeps a history.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { createBookingSchema, quoteSchema } from "./bookings.schemas.js";
import { createBooking, getBookingByReference, listMyBookings, quotePackage } from "./bookings.service.js";

export const bookingsRouter = Router();

/**
 * Called on every tile change, so its budget is generous — it writes nothing
 * and only reads a cached catalogue.
 */
bookingsRouter.post(
  "/quote",
  rateLimit({ scope: "booking-quote", max: 120, windowSeconds: 60 }),
  validate(quoteSchema),
  asyncHandler(async (req, res) => {
    ok(res, await quotePackage(req.body));
  }),
);

bookingsRouter.post(
  "/",
  rateLimit({ scope: "bookings", max: 6, windowSeconds: 300 }),
  validate(createBookingSchema),
  asyncHandler(async (req, res) => {
    ok(res, await createBooking(req.body, req.auth?.userId ?? null), 201);
  }),
);

bookingsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await listMyBookings(req.auth!.userId));
  }),
);

bookingsRouter.get(
  "/:reference",
  validate(
    z.object({
      reference: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^EVM-\d{4}-\d{4,}$/, "References look like EVM-2026-0001."),
    }),
    "params",
  ),
  asyncHandler(async (req, res) => {
    const { reference } = req.validatedParams as { reference: string };
    ok(res, await getBookingByReference(reference));
  }),
);
