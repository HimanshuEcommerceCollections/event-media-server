/**
 * /api/v1/admin/assignments/:id — editing one offer.
 *
 * Making an offer is a property of the booking, so that pair lives on
 * adminBookingsRouter as /admin/bookings/:id/assignments. Once made, an offer
 * is addressed by its own id from wherever it is being looked at, which is
 * what this router is for.
 *
 * Mounted under adminRouter, which already gates on requireAuth + requireAdmin.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { noContent, ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import {
  ASSIGNMENT_STATUSES,
  deleteAssignment,
  updateAssignment,
} from "./admin.assignments.service.js";

export const adminAssignmentsRouter = Router();

const idParams = z.object({ id: z.string().trim().min(1).max(200) });

const patchSchema = z
  .object({
    status: z.enum(ASSIGNMENT_STATUSES).optional(),
    payoutCents: z.number().int().min(0).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Send at least one field to change." });

adminAssignmentsRouter.patch(
  "/:id",
  validate(idParams, "params"),
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await updateAssignment(id, req.body as z.infer<typeof patchSchema>));
  }),
);

adminAssignmentsRouter.delete(
  "/:id",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    await deleteAssignment(id);
    noContent(res);
  }),
);
