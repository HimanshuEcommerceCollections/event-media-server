/**
 * /api/v1/admin/bookings/* — event_booking_requests, from the coordinator's
 * side. Mounted under adminRouter, which already gates on requireAuth +
 * requireAdmin.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { parsePageQuery } from "../../lib/pagination.js";
import { getBooking, listBookings, updateBookingStatus } from "./admin.bookings.service.js";
import { createAssignment, listAssignments } from "./admin.assignments.service.js";

export const adminBookingsRouter = Router();

const BOOKING_STATUSES = ["new", "confirmed", "in_progress", "completed", "cancelled"] as const;

const listQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const idParams = z.object({ id: z.string().trim().min(1).max(200) });

adminBookingsRouter.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { status } = req.validatedQuery as z.infer<typeof listQuerySchema>;
    const { page, pageSize, offset } = parsePageQuery(req.validatedQuery);
    ok(res, await listBookings(status, page, pageSize, offset));
  }),
);

adminBookingsRouter.get(
  "/:id",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await getBooking(id));
  }),
);

/* ------------------------------------------------- offers made on a booking */

const createAssignmentSchema = z.object({
  vendorId: z.string().trim().min(1).max(200),
  serviceType: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(64),
  // What the vendor is paid, which is the coordinator's call and not derived
  // from what the customer was quoted for the same line.
  payoutCents: z.number().int().min(0).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

adminBookingsRouter.get(
  "/:id/assignments",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await listAssignments(id));
  }),
);

adminBookingsRouter.post(
  "/:id/assignments",
  validate(idParams, "params"),
  validate(createAssignmentSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await createAssignment(id, req.body as z.infer<typeof createAssignmentSchema>), 201);
  }),
);

adminBookingsRouter.patch(
  "/:id/status",
  validate(idParams, "params"),
  validate(z.object({ status: z.enum(BOOKING_STATUSES) })),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { status } = req.body as { status: string };
    ok(res, await updateBookingStatus(id, status));
  }),
);
