/**
 * /api/v1/admin/{content-pages,legal-documents,gallery-items,featured-events,
 * categories,stats,testimonials,reviews} — the eight "generic content
 * resource" tables from the admin API contract, all built on
 * admin.tableResource.ts's CRUD factory. Mounted under adminRouter, which
 * already gates on requireAuth + requireAdmin.
 *
 * Every resource gets the same five routes (GET list, GET one, POST, PATCH,
 * DELETE) except `reviews`, which the contract wires as list+update only.
 */

import { Router, type RequestHandler } from "express";
import { z, type ZodType } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { noContent, ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { parsePageQuery } from "../../lib/pagination.js";
import { tableResource } from "./admin.tableResource.js";

export const adminContentRouter = Router();

const jsonObject = z.record(z.string(), z.unknown());
const jsonArray = z.array(z.unknown());

function mountResource(opts: {
  path: string;
  paramName: string;
  resource: ReturnType<typeof tableResource>;
  createSchema?: ZodType;
  updateSchema: ZodType;
  allowDelete: boolean;
}) {
  const { path, paramName, resource, createSchema, updateSchema, allowDelete } = opts;
  const paramsSchema = z.object({ [paramName]: z.string().trim().min(1).max(200) });
  const validateParams: RequestHandler = validate(paramsSchema, "params");

  adminContentRouter.get(
    path,
    asyncHandler(async (req, res) => {
      const { page, pageSize, offset } = parsePageQuery(req.query);
      ok(res, await resource.list(page, pageSize, offset));
    }),
  );

  adminContentRouter.get(
    `${path}/:${paramName}`,
    validateParams,
    asyncHandler(async (req, res) => {
      const params = req.validatedParams as Record<string, string>;
      ok(res, await resource.get(params[paramName] as string));
    }),
  );

  if (createSchema !== undefined) {
    adminContentRouter.post(
      path,
      validate(createSchema),
      asyncHandler(async (req, res) => {
        ok(res, await resource.create(req.body as Record<string, unknown>), 201);
      }),
    );
  }

  adminContentRouter.patch(
    `${path}/:${paramName}`,
    validateParams,
    validate(updateSchema),
    asyncHandler(async (req, res) => {
      const params = req.validatedParams as Record<string, string>;
      ok(res, await resource.update(params[paramName] as string, req.body as Record<string, unknown>));
    }),
  );

  if (allowDelete) {
    adminContentRouter.delete(
      `${path}/:${paramName}`,
      validateParams,
      asyncHandler(async (req, res) => {
        const params = req.validatedParams as Record<string, string>;
        await resource.remove(params[paramName] as string);
        noContent(res);
      }),
    );
  }
}

/* -------------------------------------------------------------- content pages */

mountResource({
  path: "/content-pages",
  paramName: "slug",
  resource: tableResource({
    table: "content_pages",
    pk: "slug",
    columns: ["slug", "title", "kicker", "summary", "hero", "sections", "updated_at"],
    jsonColumns: ["hero", "sections"],
    timestampColumns: ["updated_at"],
  }),
  createSchema: z.object({
    slug: z.string().trim().toLowerCase().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    kicker: z.string().trim().max(200).optional(),
    summary: z.string().trim().max(2000).optional(),
    hero: jsonObject.optional(),
    sections: jsonArray.optional(),
  }),
  updateSchema: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    kicker: z.string().trim().max(200).optional(),
    summary: z.string().trim().max(2000).optional(),
    hero: jsonObject.optional(),
    sections: jsonArray.optional(),
  }),
  allowDelete: true,
});

/* ------------------------------------------------------------ legal documents */

mountResource({
  path: "/legal-documents",
  paramName: "slug",
  resource: tableResource({
    table: "legal_documents",
    pk: "slug",
    columns: ["slug", "title", "kicker", "summary", "updated_label", "sections", "updated_at"],
    jsonColumns: ["sections"],
    timestampColumns: ["updated_at"],
  }),
  createSchema: z.object({
    slug: z.string().trim().toLowerCase().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    kicker: z.string().trim().max(200),
    summary: z.string().trim().max(2000),
    updatedLabel: z.string().trim().max(120),
    sections: jsonArray,
  }),
  updateSchema: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    kicker: z.string().trim().max(200).optional(),
    summary: z.string().trim().max(2000).optional(),
    updatedLabel: z.string().trim().max(120).optional(),
    sections: jsonArray.optional(),
  }),
  allowDelete: true,
});

/* -------------------------------------------------------------- gallery items */

mountResource({
  path: "/gallery-items",
  paramName: "id",
  resource: tableResource({
    table: "gallery_items",
    pk: "id",
    columns: ["id", "surface", "image_path", "label", "caption", "sort_order"],
    orderBy: "sort_order",
    idPrefix: "gal",
  }),
  createSchema: z.object({
    surface: z.string().trim().min(1).max(120),
    imagePath: z.string().trim().min(1).max(400),
    label: z.string().trim().min(1).max(200),
    caption: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().default(0),
  }),
  updateSchema: z.object({
    surface: z.string().trim().min(1).max(120).optional(),
    imagePath: z.string().trim().min(1).max(400).optional(),
    label: z.string().trim().min(1).max(200).optional(),
    caption: z.string().trim().max(500).optional(),
    sortOrder: z.number().int().optional(),
  }),
  allowDelete: true,
});

/* ------------------------------------------------------------ featured events */

mountResource({
  path: "/featured-events",
  paramName: "slug",
  resource: tableResource({
    table: "featured_events",
    pk: "slug",
    columns: ["slug", "name", "year", "total_cents", "total_label", "image_path", "image_alt", "sort_order"],
    orderBy: "sort_order",
  }),
  createSchema: z.object({
    slug: z.string().trim().toLowerCase().min(1).max(64),
    name: z.string().trim().min(1).max(200),
    year: z.number().int(),
    totalCents: z.number().int().min(0),
    totalLabel: z.string().trim().min(1).max(60),
    imagePath: z.string().trim().min(1).max(400),
    imageAlt: z.string().trim().min(1).max(200),
    sortOrder: z.number().int().default(0),
  }),
  updateSchema: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    year: z.number().int().optional(),
    totalCents: z.number().int().min(0).optional(),
    totalLabel: z.string().trim().min(1).max(60).optional(),
    imagePath: z.string().trim().min(1).max(400).optional(),
    imageAlt: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().optional(),
  }),
  allowDelete: true,
});

/* ----------------------------------------------------------------- categories */

mountResource({
  path: "/categories",
  paramName: "key",
  resource: tableResource({
    table: "categories",
    pk: "key",
    columns: ["key", "label", "sort_order"],
    orderBy: "sort_order",
  }),
  createSchema: z.object({
    key: z.string().trim().toLowerCase().min(1).max(64),
    label: z.string().trim().min(1).max(200),
    sortOrder: z.number().int().default(0),
  }),
  updateSchema: z.object({
    label: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().optional(),
  }),
  allowDelete: true,
});

/* ---------------------------------------------------------------------- stats */

mountResource({
  path: "/stats",
  paramName: "key",
  resource: tableResource({
    table: "stats",
    pk: "key",
    columns: ["key", "value", "decimals", "prefix", "suffix", "label", "surface", "sort_order"],
    orderBy: "sort_order",
  }),
  createSchema: z.object({
    key: z.string().trim().toLowerCase().min(1).max(64),
    value: z.number(),
    decimals: z.number().int().min(0).optional(),
    prefix: z.string().trim().max(20).optional(),
    suffix: z.string().trim().max(20).optional(),
    label: z.string().trim().min(1).max(200),
    surface: z.string().trim().max(120).optional(),
    sortOrder: z.number().int().default(0),
  }),
  updateSchema: z.object({
    value: z.number().optional(),
    decimals: z.number().int().min(0).optional(),
    prefix: z.string().trim().max(20).optional(),
    suffix: z.string().trim().max(20).optional(),
    label: z.string().trim().min(1).max(200).optional(),
    surface: z.string().trim().max(120).optional(),
    sortOrder: z.number().int().optional(),
  }),
  allowDelete: true,
});

/* ---------------------------------------------------------------- testimonials */

mountResource({
  path: "/testimonials",
  paramName: "id",
  resource: tableResource({
    table: "testimonials",
    pk: "id",
    columns: ["id", "quote", "author_name", "author_role", "initials", "surface", "sort_order"],
    orderBy: "sort_order",
    idPrefix: "tst",
  }),
  createSchema: z.object({
    quote: z.string().trim().min(1).max(2000),
    authorName: z.string().trim().min(1).max(200),
    authorRole: z.string().trim().min(1).max(200),
    initials: z.string().trim().min(1).max(8),
    surface: z.string().trim().max(120).optional(),
    sortOrder: z.number().int().default(0),
  }),
  updateSchema: z.object({
    quote: z.string().trim().min(1).max(2000).optional(),
    authorName: z.string().trim().min(1).max(200).optional(),
    authorRole: z.string().trim().min(1).max(200).optional(),
    initials: z.string().trim().min(1).max(8).optional(),
    surface: z.string().trim().max(120).optional(),
    sortOrder: z.number().int().optional(),
  }),
  allowDelete: true,
});

/* -------------------------------------------------------------------- reviews */

// Contract wires reviews as list + update only — no create, no delete.
mountResource({
  path: "/reviews",
  paramName: "id",
  resource: tableResource({
    table: "reviews",
    pk: "id",
    columns: [
      "id",
      "category_key",
      "service_label",
      "author_name",
      "initials",
      "avatar_color",
      "stars",
      "body",
      "when_label",
      "is_spotlight",
      "spotlight_quote",
      "spotlight_tag",
      "image_path",
      "is_published",
      "sort_order",
    ],
    orderBy: "sort_order",
  }),
  updateSchema: z.object({
    categoryKey: z.string().trim().min(1).max(120).optional(),
    serviceLabel: z.string().trim().min(1).max(200).optional(),
    authorName: z.string().trim().min(1).max(200).optional(),
    initials: z.string().trim().min(1).max(8).optional(),
    avatarColor: z.string().trim().min(1).max(60).optional(),
    stars: z.number().int().min(1).max(5).optional(),
    body: z.string().trim().min(1).max(4000).optional(),
    whenLabel: z.string().trim().min(1).max(60).optional(),
    isSpotlight: z.boolean().optional(),
    spotlightQuote: z.string().trim().max(4000).nullable().optional(),
    spotlightTag: z.string().trim().max(200).nullable().optional(),
    imagePath: z.string().trim().max(400).nullable().optional(),
    isPublished: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
  allowDelete: false,
});
