/**
 * POST /api/v1/requests      — submit the "one request, whole event" enquiry
 * GET  /api/v1/requests/mine — the enquiries on this account
 *
 * Submitting is open to visitors: every service page's calculator ends in a
 * request, and requiring an account first would lose the enquiry. A token is
 * attached to the row when one is sent, so a signed-in visitor can see their
 * own history.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { createQuoteRequest, listMyQuoteRequests } from "./requests.service.js";

export const requestsRouter = Router();

const lineItem = z.object({
  key: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(160),
  quantity: z.number().int().min(0).max(10_000).default(1),
  unitCents: z.number().int().min(0).max(100_000_000),
});

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That does not look like an email address.")
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  // Kept as a plain ISO date string: the event date is a calendar day chosen
  // in the visitor's own locale, not an instant, so a timezone would only
  // introduce a day-boundary bug.
  eventDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-14.")
    .optional(),
  serviceSlug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(64)
    .optional(),
  lineItems: z.array(lineItem).max(50).default([]),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateRequestInput = z.infer<typeof createSchema>;

requestsRouter.post(
  "/",
  rateLimit({ scope: "quote-requests", max: 6, windowSeconds: 300 }),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    ok(res, await createQuoteRequest(req.body as CreateRequestInput, req.auth?.userId ?? null), 201);
  }),
);

requestsRouter.get(
  "/mine",
  requireAuth,
  asyncHandler(async (req, res) => {
    ok(res, await listMyQuoteRequests(req.auth!.userId));
  }),
);
