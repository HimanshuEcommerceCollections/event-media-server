/**
 * Loads the pricing catalogue out of the service blocks that already hold it.
 *
 * Cached in memory: the catalogue changes only when the seed runs, and pricing
 * a six-service package would otherwise be six round trips on the hot path of
 * the one page the site is built around.
 */

import { query } from "../../db/pool.js";
import { logger } from "../../lib/logger.js";
import type { PricingModel, ServicePricing } from "./pricing.types.js";

type Row = {
  slug: string;
  title: string;
  is_b2b: boolean;
  sort_order: number;
  payload: PricingModel;
};

let cache: Map<string, ServicePricing> | null = null;

export async function loadCatalogue(): Promise<Map<string, ServicePricing>> {
  if (cache !== null) return cache;

  const rows = await query<Row>(
    `SELECT s.slug, s.title, s.is_b2b, s.sort_order, b.payload
       FROM services s
       JOIN service_blocks b ON b.slug = s.slug AND b.kind = 'pricing'
      WHERE s.is_active
      ORDER BY s.sort_order`,
  );

  const next = new Map<string, ServicePricing>();
  for (const row of rows) {
    next.set(row.slug, {
      serviceType: row.slug,
      title: row.title,
      isB2b: row.is_b2b,
      pricing: row.payload,
    });
  }

  if (next.size === 0) {
    // Pricing nothing is not the same as everything being free, and a booking
    // priced against an empty catalogue would total zero and look valid.
    throw new Error("Pricing catalogue is empty — has the content been seeded?");
  }

  logger.debug("pricing catalogue loaded", { services: next.size });
  cache = next;
  return cache;
}

/** Called by the seed once it has rewritten the catalogue. */
export function invalidateCatalogue(): void {
  cache = null;
}
