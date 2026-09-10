/**
 * /api/v1/admin/vendors/* — vendor_applications, from the coordinator's side.
 * Mounted under adminRouter, which already gates on requireAuth + requireAdmin.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { parsePageQuery } from "../../lib/pagination.js";
import { getVendor, listVendors, updateVendorStatus } from "./admin.vendors.service.js";

export const adminVendorsRouter = Router();

const VENDOR_STATUSES = ["new", "reviewing", "approved", "rejected"] as const;

const listQuerySchema = z.object({
  status: z.enum(VENDOR_STATUSES).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const idParams = z.object({ id: z.string().trim().min(1).max(200) });

adminVendorsRouter.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { status } = req.validatedQuery as z.infer<typeof listQuerySchema>;
    const { page, pageSize, offset } = parsePageQuery(req.validatedQuery);
    ok(res, await listVendors(status, page, pageSize, offset));
  }),
);

adminVendorsRouter.get(
  "/:id",
  validate(idParams, "params"),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    ok(res, await getVendor(id));
  }),
);

adminVendorsRouter.patch(
  "/:id/status",
  validate(idParams, "params"),
  validate(z.object({ status: z.enum(VENDOR_STATUSES) })),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as { id: string };
    const { status } = req.body as { status: string };
    ok(res, await updateVendorStatus(id, status));
  }),
);
