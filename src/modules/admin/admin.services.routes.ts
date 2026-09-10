/**
 * /api/v1/admin/services/* — services + service_blocks. Mounted under
 * adminRouter, which already gates on requireAuth + requireAdmin.
 *
 * No DELETE: the contract has the admin deactivate a service with
 * `PATCH { isActive: false }` instead.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { parsePageQuery } from "../../lib/pagination.js";
import { createService, getService, listServices, updateService } from "./admin.services.service.js";
import type { ServiceInput } from "./admin.services.service.js";

export const adminServicesRouter = Router();

const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(64) });

const blockSchema = z.object({
  kind: z.string().trim().min(1).max(60),
  sortOrder: z.number().int(),
  payload: z.record(z.string(), z.unknown()),
});

const createSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(64),
  no: z.string().trim().min(1).max(10),
  title: z.string().trim().min(1).max(200),
  blurb: z.string().trim().min(1).max(2000),
  priceLabel: z.string().trim().min(1).max(60),
  priceCents: z.number().int().min(0).nullable().optional(),
  priceUnit: z.string().trim().max(60).nullable().optional(),
  isB2b: z.boolean().optional(),
  imagePath: z.string().trim().min(1).max(400),
  imageAlt: z.string().trim().min(1).max(200),
  iconKey: z.string().trim().min(1).max(60),
  hero: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  no: z.string().trim().min(1).max(10).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  blurb: z.string().trim().min(1).max(2000).optional(),
  priceLabel: z.string().trim().min(1).max(60).optional(),
  priceCents: z.number().int().min(0).nullable().optional(),
  priceUnit: z.string().trim().max(60).nullable().optional(),
  isB2b: z.boolean().optional(),
  imagePath: z.string().trim().min(1).max(400).optional(),
  imageAlt: z.string().trim().min(1).max(200).optional(),
  iconKey: z.string().trim().min(1).max(60).optional(),
  hero: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  blocks: z.array(blockSchema).optional(),
});

adminServicesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePageQuery(req.query);
    ok(res, await listServices(page, pageSize, offset));
  }),
);

adminServicesRouter.get(
  "/:slug",
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await getService(slug));
  }),
);

adminServicesRouter.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    ok(res, await createService(req.body as ServiceInput), 201);
  }),
);

adminServicesRouter.patch(
  "/:slug",
  validate(slugParams, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await updateService(slug, req.body as Parameters<typeof updateService>[1]));
  }),
);
