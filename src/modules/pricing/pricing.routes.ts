/**
 * GET /api/v1/pricing          — the pricing.v1 document /pricing transcludes
 * GET /api/v1/pricing/builder  — the six configurators plus the builder enums
 * GET /api/v1/pricing/:slug    — one service's model
 *
 * Public and cacheable: pricing changes when the seed runs, not per request.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { cacheable } from "../../lib/cache.js";
import { getBuilderCatalogue, getPricingDocument, getServicePricing } from "./pricing.service.js";

export const pricingRouter = Router();

pricingRouter.get(
  "/",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await getPricingDocument());
  }),
);

pricingRouter.get(
  "/builder",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await getBuilderCatalogue());
  }),
);

pricingRouter.get(
  "/:slug",
  cacheable(300),
  validate(
    z.object({
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "That is not a valid slug.")
        .max(64),
    }),
    "params",
  ),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await getServicePricing(slug));
  }),
);
