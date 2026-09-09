/**
 * POST /api/v1/vendors/applications      — Become a Vendor
 * GET  /api/v1/vendors/applications/:ref — the submitted application
 * GET  /api/v1/vendors/service-types     — what can be applied for
 *
 * Open to visitors: a vendor applies before they have an account, and the
 * reference is what they quote when they follow up.
 */

import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { ok } from "../../lib/http.js";
import { validate } from "../../middleware/validate.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { cacheable } from "../../lib/cache.js";
import { createApplication, getApplication, listServiceTypes } from "./vendors.service.js";

export const vendorsRouter = Router();

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(64);

/**
 * Part-107 details are collected as typed, deliberately unvalidated: nothing
 * here checks a certificate against the FAA, and no surface may present a
 * submitted number as a certification.
 */
const part107 = z
  .object({
    certificateNumber: z.string().trim().min(1).max(64),
    expiresOn: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2028-03-01.")
      .optional(),
    documentName: z.string().trim().max(200).optional(),
  })
  .optional();

const applicationSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name.").max(160),
  contactName: z.string().trim().min(2, "Enter a contact name.").max(120),
  email: z
    .string()
    .trim()
    .max(254)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That does not look like an email address.")
    .transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  website: z.string().trim().url("Enter a full URL, including the https:// prefix.").max(300).optional(),
  serviceTypes: z.array(slug).min(1, "Choose at least one service you provide.").max(10),
  yearsActive: z.number().int().min(0).max(100).optional(),
  serviceArea: z.string().trim().max(200).optional(),
  hasInsurance: z.boolean().default(false),
  part107,
  portfolioUrl: z.string().trim().url("Enter a full URL, including the https:// prefix.").max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

vendorsRouter.get(
  "/service-types",
  cacheable(300),
  asyncHandler(async (_req, res) => {
    ok(res, await listServiceTypes());
  }),
);

vendorsRouter.post(
  "/applications",
  rateLimit({ scope: "vendor-applications", max: 4, windowSeconds: 900 }),
  validate(applicationSchema),
  asyncHandler(async (req, res) => {
    ok(res, await createApplication(req.body as ApplicationInput, req.auth?.userId ?? null), 201);
  }),
);

vendorsRouter.get(
  "/applications/:reference",
  validate(
    z.object({
      reference: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^EVV-\d{4}-\d{4,}$/, "References look like EVV-2026-0001."),
    }),
    "params",
  ),
  asyncHandler(async (req, res) => {
    const { reference } = req.validatedParams as { reference: string };
    ok(res, await getApplication(reference));
  }),
);
