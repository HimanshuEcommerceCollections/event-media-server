/**
 * GET /api/v1/content/*
 *
 * All public — no page's content is behind a sign-in. Responses carry a short
 * s-maxage so Next's own revalidation window is not the only cache in play.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { cacheable } from "../../lib/cache.js";
import * as service from "./content.service.js";
import { recordRatingPulse } from "./ratings.service.js";

export const contentRouter = Router();

/** A slug in a path: lowercase words joined by single hyphens. */
const slugParams = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "That is not a valid slug.")
    .max(64),
});

contentRouter.get(
  "/home",
  cacheable(60),
  asyncHandler(async (_req, res) => {
    ok(res, await service.getHomeContent());
  }),
);

contentRouter.get(
  "/services",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await service.listServiceSummaries());
  }),
);

contentRouter.get(
  "/services/:slug",
  cacheable(300),
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await service.getServiceDetail(slug));
  }),
);

contentRouter.get(
  "/reviews",
  cacheable(60),
  asyncHandler(async (_req, res) => {
    ok(res, await service.getReviewsContent());
  }),
);

contentRouter.get(
  "/legal",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await service.listLegalDocuments());
  }),
);

contentRouter.get(
  "/legal/:slug",
  cacheable(300),
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await service.getLegalDocument(slug));
  }),
);

contentRouter.get(
  "/pages",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await service.listPages());
  }),
);

contentRouter.get(
  "/pages/:slug",
  cacheable(300),
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await service.getPage(slug));
  }),
);

/**
 * The B2B surface: the commercial page copy plus the two commercial-leaning
 * services with their own pricing, so /commercial is one call.
 */
contentRouter.get(
  "/commercial",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await service.getCommercialContent());
  }),
);

contentRouter.get(
  "/bundles",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await service.listBundles());
  }),
);

/** The bundle-seed convention: everything /build needs to pre-tick its tiles. */
contentRouter.get(
  "/bundles/:slug",
  cacheable(300),
  validate(slugParams, "params"),
  asyncHandler(async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    ok(res, await service.getBundleSeed(slug));
  }),
);

/**
 * The star tapped at the bottom of the reviews page. Anonymous — a token is
 * used if one is sent, and not required, because the widget is offered to
 * every visitor.
 */
contentRouter.post(
  "/reviews/pulse",
  rateLimit({ scope: "rating-pulse", max: 10, windowSeconds: 60 }),
  validate(z.object({ stars: z.number().int().min(1).max(5) })),
  asyncHandler(async (req, res) => {
    const { stars } = req.body as { stars: number };
    ok(res, await recordRatingPulse(stars, req.auth?.userId ?? null, req.ip ?? null), 201);
  }),
);
