/**
 * Prices a configuration against the catalogue.
 *
 * The client posts what was chosen — a pack key, an hour count, a quantity map
 * — and never a price. Every figure in the result is read from the catalogue
 * here, so the running total the page shows can be checked rather than
 * trusted, and a stale one is a rejected submission rather than a wrong quote.
 *
 * The four formulas are exactly the ones the service-page calculators use:
 *   items      Σ quantity × unitCents
 *   performers base + hourly × hours
 *   hourly     hourly × hours + Σ add-ons
 *   packs      pack + Σ add-ons
 * A change on either side that is not made on both shows up as a mismatch on
 * the next submission, which is the point.
 */

import { badRequest } from "../../lib/http.js";
import { loadCatalogue } from "./pricing.catalogue.js";
import type { Configuration, PricedLine, ServicePricing } from "./pricing.types.js";

const MAX_QUANTITY = 10_000;

export const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Prices one tile. Throws a 400 naming the field whenever a key is unknown. */
export async function priceLine(
  serviceType: string,
  configuration: Configuration,
  bundleId?: string,
): Promise<PricedLine> {
  const catalogue = await loadCatalogue();
  const entry = catalogue.get(serviceType);
  if (entry === undefined) throw badRequest(`We do not offer a service called "${serviceType}".`);

  const breakdown = breakdownFor(entry, configuration);
  const lineCents = breakdown.reduce((sum, part) => sum + part.cents, 0);

  return {
    serviceType,
    label: entry.title,
    configuration,
    lineCents,
    breakdown,
    ...(bundleId === undefined ? {} : { bundleId }),
  };
}

/** Prices a whole package. The total is the sum of the lines, to the cent. */
export async function pricePackage(
  lines: { serviceType: string; configuration: Configuration; bundleId?: string }[],
): Promise<{ lineItems: PricedLine[]; packageTotal: number }> {
  const lineItems: PricedLine[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Two tiles for one service would double-count against a builder that can
    // only show one configurator per service.
    if (seen.has(line.serviceType)) {
      throw badRequest(`${line.serviceType} is configured twice — send one line per service.`);
    }
    seen.add(line.serviceType);
    lineItems.push(await priceLine(line.serviceType, line.configuration, line.bundleId));
  }

  const priced = lineItems.filter((item) => item.lineCents > 0);
  return {
    lineItems: priced,
    packageTotal: priced.reduce((sum, item) => sum + item.lineCents, 0),
  };
}

/* ------------------------------------------------------------- the formulas */

function breakdownFor(entry: ServicePricing, config: Configuration) {
  const p = entry.pricing;

  switch (p.model) {
    case "items": {
      const quantities = config.quantities ?? {};
      const unknown = Object.keys(quantities).filter(
        (key) => !p.items.some((item) => item.key === key),
      );
      if (unknown.length > 0) {
        throw badRequest(`${entry.title} has no item called "${unknown[0]}".`);
      }
      return p.items
        .map((item) => {
          const qty = wholeNumber(quantities[item.key] ?? 0, `${entry.title} · ${item.label}`);
          return {
            label: item.label,
            detail: `${qty} × ${money(item.unitCents)}`,
            cents: qty * item.unitCents,
          };
        })
        .filter((part) => part.cents > 0);
    }

    case "performers": {
      if (config.performer === undefined) throw badRequest("Choose a performer.");
      const performer = p.performers.find((x) => x.key === config.performer);
      if (performer === undefined) {
        throw badRequest(`We do not book a "${config.performer}".`);
      }
      const hours = boundedHours(config.hours, p.minHours, p.maxHours, entry.title);
      return [
        { label: performer.name, detail: "Booking fee", cents: performer.baseCents },
        {
          label: `${hours} ${hours === 1 ? "hour" : "hours"}`,
          detail: `${hours} × ${money(performer.hourlyCents)}`,
          cents: performer.hourlyCents * hours,
        },
      ];
    }

    case "hourly": {
      const hours = boundedHours(config.hours, p.minHours, p.maxHours, entry.title);
      return [
        {
          label: `${hours} ${hours === 1 ? "hour" : "hours"}`,
          detail: `${hours} × ${money(p.hourlyCents)}`,
          cents: p.hourlyCents * hours,
        },
        ...pickAddons(entry, p.addons, config.addons),
      ];
    }

    case "packs": {
      if (config.pack === undefined) throw badRequest(`Choose a ${entry.title} package.`);
      const pack = p.packs.find((x) => x.key === config.pack);
      if (pack === undefined) {
        throw badRequest(`${entry.title} has no package called "${config.pack}".`);
      }
      return [
        { label: pack.name, detail: "Package", cents: pack.cents },
        ...pickAddons(entry, p.addons, config.addons),
      ];
    }
  }
}

function pickAddons(
  entry: ServicePricing,
  available: { key: string; name: string; cents: number }[],
  chosen: string[] | undefined,
) {
  const keys = [...new Set(chosen ?? [])];
  return keys.map((key) => {
    const addon = available.find((x) => x.key === key);
    if (addon === undefined) throw badRequest(`${entry.title} has no add-on called "${key}".`);
    return { label: addon.name, detail: "Add-on", cents: addon.cents };
  });
}

function wholeNumber(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > MAX_QUANTITY) {
    throw badRequest(`${field}: enter a whole number between 0 and ${MAX_QUANTITY}.`);
  }
  return value;
}

function boundedHours(value: number | undefined, min: number, max: number, title: string): number {
  const hours = value ?? min;
  if (!Number.isInteger(hours) || hours < min || hours > max) {
    throw badRequest(`${title} is booked for ${min}–${max} hours.`);
  }
  return hours;
}
