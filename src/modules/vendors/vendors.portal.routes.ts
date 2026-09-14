/**
 * /api/v1/vendors/me/* — the vendor's own dashboard.
 *
 * Mounted inside vendorsRouter *before* its public `/applications/:reference`
 * route, and gated on requireAuth + requireVendor, which loads the caller's
 * vendor profile onto req.vendor. Nothing under here takes a vendor id from
 * the caller: the profile the guard resolved is the only vendor these
 * handlers can act as, so one vendor cannot read or answer another's work by
 * changing an id in a URL.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth, requireVendor } from "../../middleware/auth.js";
import { parsePageQuery } from "../../lib/pagination.js";
import {
  completeAssignment,
  getMyAssignment,
  getMyProfile,
  listMyAssignments,
  respondToAssignment,
  updateMyProfile,
} from "./vendors.portal.service.js";
import type { ProfilePatch, ResponseAction } from "./vendors.portal.service.js";

export const vendorPortalRouter = Router();

vendorPortalRouter.use(requireAuth, requireVendor);

const ASSIGNMENT_STATUSES = ["offered", "accepted", "declined", "withdrawn", "completed"] as const;

/**
 * An empty string is how a cleared text input arrives, and it means "I do not
 * have one" rather than "leave it alone" — so it is stored as NULL.
 */
const blankToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const profileSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(160).optional(),
  contactName: z.string().trim().min(2, "Enter a contact name.").max(120).optional(),
  phone: blankToNull(40),
  website: blankToNull(300),
  serviceArea: blankToNull(200),
  yearsActive: z.number().int().min(0).max(100).nullable().optional(),
  hasInsurance: z.boolean().optional(),
  portfolioUrl: blankToNull(300),
  bio: blankToNull(2000),
});

const idParams = z.object({ id: z.string().trim().min(1).max(200) });

const listQuerySchema = z.object({
  status: z.enum(ASSIGNMENT_STATUSES).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const respondSchema = z.object({
  action: z.enum(["accept", "decline"]),
  note: z.string().trim().max(1000).optional(),
});

/* ----------------------------------------------------------------- profile */

vendorPortalRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    ok(res, await getMyProfile(req.vendor!));
  }),
);

vendorPortalRouter.patch(
  "/",
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    ok(res, await updateMyProfile(req.vendor!, req.body as ProfilePatch));
  }),
);

/* ------------------------------------------------------------- assignments */

vendorPortalRouter.get(
  "/assignments",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { status } = req.validatedQuery as z.infer<typeof listQuerySchema>;
    const { page, pageSize, offset } = parsePageQuery(req.validatedQuery);
    ok(res, await listMyAssignments(req.vendor!, status, page, pageSize, offset));
  }),
);

vendorPortalRouter.get(
  "/assignments/:id",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await getMyAssignment(req.vendor!, id));
  }),
);

vendorPortalRouter.post(
  "/assignments/:id/respond",
  validate(idParams, "params"),
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { action, note } = req.body as { action: ResponseAction; note?: string };
    ok(res, await respondToAssignment(req.vendor!, id, action, note));
  }),
);

vendorPortalRouter.post(
  "/assignments/:id/complete",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await completeAssignment(req.vendor!, id));
  }),
);
