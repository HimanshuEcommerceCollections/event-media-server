/**
 * The pricing contract — published as `pricing.v1`.
 *
 * One catalogue, four models, and it is the same catalogue the service pages
 * render and the builder prices against. Duplicating the numbers into a second
 * document is what makes a total go stale, so there is no second document.
 */

export const PRICING_VERSION = "pricing.v1";

/** Party rentals: a quantity per row, priced per item. */
export type ItemsModel = {
  model: "items";
  items: { key: string; label: string; unitCents: number; step: number; note?: string }[];
  startQuantities?: Record<string, number>;
};

/** Entertainers: pick an act, then hours — a base fee plus an hourly rate. */
export type PerformersModel = {
  model: "performers";
  minHours: number;
  maxHours: number;
  performers: { key: string; name: string; baseCents: number; hourlyCents: number }[];
};

/** DJ + music: one hourly rate plus optional add-ons. */
export type HourlyModel = {
  model: "hourly";
  hourlyCents: number;
  minHours: number;
  maxHours: number;
  addons: { key: string; name: string; cents: number }[];
};

/** Photo/video, virtual tours, drone: pick one pack plus optional add-ons. */
export type PacksModel = {
  model: "packs";
  packs: { key: string; name: string; cents: number }[];
  addons: { key: string; name: string; cents: number }[];
};

export type PricingModel = ItemsModel | PerformersModel | HourlyModel | PacksModel;

export type ServicePricing = {
  serviceType: string;
  title: string;
  isB2b: boolean;
  pricing: PricingModel;
};

/** What the client posts for one tile. Prices are never part of it. */
export type Configuration = {
  /** items model */
  quantities?: Record<string, number>;
  /** performers model */
  performer?: string;
  /** performers + hourly models */
  hours?: number;
  /** packs model */
  pack?: string;
  /** hourly + packs models */
  addons?: string[];
};

/** One priced line. `breakdown` is what the receipt prints under the line. */
export type PricedLine = {
  serviceType: string;
  label: string;
  configuration: Configuration;
  lineCents: number;
  breakdown: { label: string; detail: string; cents: number }[];
  bundleId?: string;
};
