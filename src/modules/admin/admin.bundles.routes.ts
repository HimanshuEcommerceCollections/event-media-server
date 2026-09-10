/**
 * /api/v1/admin/bundles/* — bundles + bundle_items. Mounted under
 * adminRouter, which already gates on requireAuth + requireAdmin.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { parsePageQuery } from "../../lib/pagination.js";
import { createBundle, getBundle, listBundles, updateBundle } from "./admin.bundles.service.js";
import type { BundleInput } from "./admin.bundles.service.js";

export const adminBundlesRouter = Router();

const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(64) });

const itemSchema = z.object({
  serviceSlug: z.string().trim().toLowerCase().min(1).max(64),
  configuration: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int(),
});

const createSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  tagline: z.string().trim().min(1).max(200),
  blurb: z.string().trim().min(1).max(2000),
  eventType: z.string().trim().min(1).max(60),
  badge: z.string().trim().max(60).nullable().optional(),
  imagePath: z.string().trim().max(400).nullable().optional(),
  imageAlt: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  tagline: z.string().trim().min(1).max(200).optional(),
  blurb: z.string().trim().min(1).max(2000).optional(),
  eventType: z.string().trim().min(1).max(60).optional(),
  badge: z.string().trim().max(60).nullable().optional(),
  imagePath: z.string().trim().max(400).nullable().optional(),
  imageAlt: z.string().trim().max(200).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  items: z.array(itemSchema).optional(),
});

adminBundlesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize, offset } = parsePageQuery(req.query);
    ok(res, await listBundles(page, pageSize, offset));
  }),
);

adminBundlesRouter.get(
  "/:slug",
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await getBundle(slug));
  }),
);

adminBundlesRouter.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    ok(res, await createBundle(req.body as BundleInput), 201);
  }),
);

adminBundlesRouter.patch(
  "/:slug",
  validate(slugParams, "params"),
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await updateBundle(slug, req.body as Parameters<typeof updateBundle>[1]));
  }),
);
