/**
 * The published pricing document and the builder's catalogue.
 *
 * `/pricing` transcludes the document rather than restating any figure, and
 * `/build` loads the catalogue once instead of fetching six service pages to
 * find six configurators. Both are the same rows the engine prices against.
 */

import { query } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { loadCatalogue } from "./pricing.catalogue.js";
import { money } from "./pricing.engine.js";
import { PRICING_VERSION, type PricingModel } from "./pricing.types.js";

type ServiceRow = {
  slug: string;
  no: string;
  title: string;
  blurb: string;
  price_label: string;
  is_b2b: boolean;
  icon_key: string;
  sort_order: number;
};

/**
 * pricing.v1 — every figure the site quotes, in one versioned document.
 * `from` is the cheapest way to buy each service, computed rather than
 * authored so it cannot drift from the rows beneath it.
 */
export async function getPricingDocument() {
  const [catalogue, rows] = await Promise.all([loadCatalogue(), listServiceRows()]);

  const services = rows.map((row) => {
    const model = catalogue.get(row.slug)?.pricing;
    const fromCents = model === undefined ? null : cheapestOf(model);
    return {
      serviceType: row.slug,
      no: row.no,
      title: row.title,
      blurb: row.blurb,
      isB2b: row.is_b2b,
      iconKey: row.icon_key,
      priceLabel: row.price_label,
      fromCents,
      fromLabel: fromCents === null ? row.price_label : money(fromCents),
      pricing: model ?? null,
    };
  });

  return {
    version: PRICING_VERSION,
    currency: "USD",
    // Stated once, here, so no page has to explain the unit itself.
    unit: "cents",
    note: "Estimated pricing. Weddings and events over 100 guests are quoted by a coordinator.",
    services,
  };
}

/** The same catalogue, trimmed to what a configurator tile needs to render. */
export async function getBuilderCatalogue() {
  const [catalogue, rows] = await Promise.all([loadCatalogue(), listServiceRows()]);

  return {
    version: PRICING_VERSION,
    services: rows.map((row) => ({
      serviceType: row.slug,
      no: row.no,
      title: row.title,
      blurb: row.blurb,
      iconKey: row.icon_key,
      isB2b: row.is_b2b,
      pricing: catalogue.get(row.slug)?.pricing ?? null,
    })),
    eventTypes: EVENT_TYPES,
    headcountBands: HEADCOUNT_BANDS,
    budgetBands: BUDGET_BANDS,
  };
}

export async function getServicePricing(slug: string) {
  const catalogue = await loadCatalogue();
  const entry = catalogue.get(slug);
  if (entry === undefined) throw notFound("We do not offer that service.");
  return { version: PRICING_VERSION, serviceType: slug, title: entry.title, pricing: entry.pricing };
}

/* ------------------------------------------------------------- the enums */

/** A wedding always raises the large-event banner, whatever the headcount. */
export const EVENT_TYPES: readonly { key: string; label: string; alwaysLarge?: boolean }[] = [
  { key: "wedding", label: "Wedding", alwaysLarge: true },
  { key: "birthday", label: "Birthday" },
  { key: "corporate", label: "Corporate" },
  { key: "gala", label: "Gala" },
  { key: "listing", label: "Property listing" },
  { key: "other", label: "Something else" },
] as const;

/** Ordered smallest to largest; `100+` raises the banner on its own. */
export const HEADCOUNT_BANDS: readonly { key: string; label: string; large?: boolean }[] = [
  { key: "1-25", label: "1–25 guests" },
  { key: "26-50", label: "26–50 guests" },
  { key: "51-100", label: "51–100 guests" },
  { key: "100+", label: "100+ guests", large: true },
] as const;

export const BUDGET_BANDS: readonly { key: string; label: string }[] = [
  { key: "under-1k", label: "Under $1,000" },
  { key: "1k-3k", label: "$1,000–$3,000" },
  { key: "3k-7k", label: "$3,000–$7,000" },
  { key: "7k-15k", label: "$7,000–$15,000" },
  { key: "15k+", label: "$15,000+" },
] as const;

export const EVENT_TYPE_KEYS = EVENT_TYPES.map((t) => t.key);
export const HEADCOUNT_BAND_KEYS = HEADCOUNT_BANDS.map((b) => b.key);
export const BUDGET_BAND_KEYS = BUDGET_BANDS.map((b) => b.key);

/**
 * The large-event rule, in one place because two surfaces ask it: the banner
 * at step 1 and the caveat repeated on the summary.
 */
export function isLargeEvent(eventType: string, headcountBand: string): boolean {
  const type = EVENT_TYPES.find((t) => t.key === eventType);
  const band = HEADCOUNT_BANDS.find((b) => b.key === headcountBand);
  return type?.alwaysLarge === true || band?.large === true;
}

/* ---------------------------------------------------------------- helpers */

const listServiceRows = () =>
  query<ServiceRow>(
    `SELECT slug, no, title, blurb, price_label, is_b2b, icon_key, sort_order
       FROM services WHERE is_active ORDER BY sort_order`,
  );

/** The floor of a model: the smallest bill that still buys the service. */
function cheapestOf(model: PricingModel): number | null {
  switch (model.model) {
    case "items": {
      const cheapest = model.items.reduce(
        (min, item) => (min === null || item.unitCents < min ? item.unitCents : min),
        null as number | null,
      );
      return cheapest;
    }
    case "performers": {
      const costs = model.performers.map((p) => p.baseCents + p.hourlyCents * model.minHours);
      return costs.length === 0 ? null : Math.min(...costs);
    }
    case "hourly":
      return model.hourlyCents * model.minHours;
    case "packs": {
      const costs = model.packs.map((p) => p.cents);
      return costs.length === 0 ? null : Math.min(...costs);
    }
  }
}
