/**
 * The wire shape of an event booking request.
 *
 * A line carries `serviceType` and `configuration` and nothing else: no price
 * is accepted from the client. `clientTotal` is optional and advisory — when
 * it is sent it is compared against the priced total and a mismatch is
 * rejected, which turns "the running total went stale" into a caught error
 * rather than a wrong quote in the inbox.
 */

import { z } from "zod";
import {
  BUDGET_BAND_KEYS,
  EVENT_TYPE_KEYS,
  HEADCOUNT_BAND_KEYS,
} from "../pricing/pricing.service.js";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "That is not a valid key.")
  .max(64);

const configuration = z
  .object({
    quantities: z.record(slug, z.number().int().min(0).max(10_000)).optional(),
    performer: slug.optional(),
    hours: z.number().int().min(0).max(24).optional(),
    pack: slug.optional(),
    addons: z.array(slug).max(20).optional(),
  })
  .strict();

const lineItem = z.object({
  serviceType: slug,
  configuration: configuration.default({}),
  bundleId: slug.optional(),
});

export const createBookingSchema = z.object({
  event: z.object({
    type: z.enum(EVENT_TYPE_KEYS as [string, ...string[]], {
      message: "Tell us what kind of event this is.",
    }),
    // A calendar day, not an instant — see the column comment in 002.
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-08-14.")
      .optional(),
    headcountBand: z.enum(HEADCOUNT_BAND_KEYS as [string, ...string[]], {
      message: "Choose roughly how many guests you expect.",
    }),
    zip: z
      .string()
      .trim()
      .regex(/^\d{5}(?:-\d{4})?$/, "Enter a 5-digit ZIP code.")
      .optional(),
  }),
  lineItems: z.array(lineItem).min(1, "Configure at least one service.").max(6),
  contact: z.object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z
      .string()
      .trim()
      .max(254)
      .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "That does not look like an email address.")
      .transform((v) => v.toLowerCase()),
    phone: z.string().trim().max(40).optional(),
  }),
  budgetBand: z.enum(BUDGET_BAND_KEYS as [string, ...string[]]).optional(),
  notes: z.string().trim().max(2000).optional(),
  bundleId: slug.optional(),
  source: z.enum(["build", "service-page", "bundle", "commercial"]).default("build"),
  /** What the page had on screen, in cents. Checked, never used as the price. */
  clientTotal: z.number().int().min(0).max(100_000_000).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** A dry run of the same body: prices it and returns the receipt, stores nothing. */
export const quoteSchema = z.object({
  event: createBookingSchema.shape.event.partial({ type: true, headcountBand: true }).optional(),
  lineItems: z.array(lineItem).max(6).default([]),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
