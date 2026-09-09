import { query, queryOne } from "../../db/pool.js";

export type ServiceRow = {
  slug: string;
  no: string;
  title: string;
  blurb: string;
  price_label: string;
  price_cents: number | null;
  price_unit: string | null;
  is_b2b: boolean;
  image_path: string;
  image_alt: string;
  icon_key: string;
  hero: Record<string, unknown>;
  sort_order: number;
};

export type ServiceBlockRow = {
  id: string;
  slug: string;
  kind: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

export type FeaturedEventRow = {
  slug: string;
  name: string;
  year: number;
  total_cents: number;
  total_label: string;
  image_path: string;
  image_alt: string;
};

export type CategoryRow = { key: string; label: string };

export type TestimonialRow = {
  id: string;
  quote: string;
  author_name: string;
  author_role: string;
  initials: string;
};

export type StatRow = {
  key: string;
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
};

export type ReviewRow = {
  id: string;
  category_key: string;
  service_label: string;
  author_name: string;
  initials: string;
  avatar_color: string;
  stars: number;
  body: string;
  when_label: string;
  is_spotlight: boolean;
  spotlight_quote: string | null;
  spotlight_tag: string | null;
  image_path: string | null;
};

export type GalleryRow = {
  id: string;
  surface: string;
  image_path: string;
  label: string;
  caption: string | null;
};

export type LegalRow = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  updated_label: string;
  sections: unknown;
  updated_at: number;
};

const SERVICE_COLUMNS = `
  slug, no, title, blurb, price_label, price_cents, price_unit,
  is_b2b, image_path, image_alt, icon_key, hero, sort_order
`;

export const listServices = (): Promise<ServiceRow[]> =>
  query<ServiceRow>(
    `SELECT ${SERVICE_COLUMNS} FROM services WHERE is_active ORDER BY sort_order`,
  );

export const findService = (slug: string): Promise<ServiceRow | null> =>
  queryOne<ServiceRow>(
    `SELECT ${SERVICE_COLUMNS} FROM services WHERE slug = $1 AND is_active`,
    [slug],
  );

export const listServiceBlocks = (slug: string): Promise<ServiceBlockRow[]> =>
  query<ServiceBlockRow>(
    "SELECT id, slug, kind, sort_order, payload FROM service_blocks WHERE slug = $1 ORDER BY kind, sort_order",
    [slug],
  );

export const listFeaturedEvents = (): Promise<FeaturedEventRow[]> =>
  query<FeaturedEventRow>(
    `SELECT slug, name, year, total_cents, total_label, image_path, image_alt
       FROM featured_events ORDER BY sort_order`,
  );

export const listCategories = (): Promise<CategoryRow[]> =>
  query<CategoryRow>("SELECT key, label FROM categories ORDER BY sort_order");

export const listTestimonials = (surface: string): Promise<TestimonialRow[]> =>
  query<TestimonialRow>(
    `SELECT id, quote, author_name, author_role, initials
       FROM testimonials WHERE surface = $1 ORDER BY sort_order`,
    [surface],
  );

export const listStats = (surface: string): Promise<StatRow[]> =>
  query<StatRow>(
    `SELECT key, value, decimals, prefix, suffix, label
       FROM stats WHERE surface = $1 ORDER BY sort_order`,
    [surface],
  );

export const listReviews = (): Promise<ReviewRow[]> =>
  query<ReviewRow>(
    `SELECT id, category_key, service_label, author_name, initials, avatar_color,
            stars, body, when_label, is_spotlight, spotlight_quote, spotlight_tag, image_path
       FROM reviews WHERE is_published ORDER BY sort_order`,
  );

/**
 * The star histogram and averages, computed from the published rows rather
 * than stored, so adding a review cannot leave the summary disagreeing with
 * the wall below it.
 */
export const reviewSummary = (): Promise<
  { total: number; average: number; five: number; four: number; three: number; two: number; one: number } | null
> =>
  queryOne(
    `SELECT COUNT(*)::bigint                                   AS total,
            COALESCE(AVG(stars), 0)::numeric                   AS average,
            COUNT(*) FILTER (WHERE stars = 5)::bigint          AS five,
            COUNT(*) FILTER (WHERE stars = 4)::bigint          AS four,
            COUNT(*) FILTER (WHERE stars = 3)::bigint          AS three,
            COUNT(*) FILTER (WHERE stars = 2)::bigint          AS two,
            COUNT(*) FILTER (WHERE stars = 1)::bigint          AS one
       FROM reviews WHERE is_published`,
  );

export const listGallery = (surface: string): Promise<GalleryRow[]> =>
  query<GalleryRow>(
    `SELECT id, surface, image_path, label, caption
       FROM gallery_items WHERE surface = $1 ORDER BY sort_order`,
    [surface],
  );

export const findLegalDocument = (slug: string): Promise<LegalRow | null> =>
  queryOne<LegalRow>(
    `SELECT slug, title, kicker, summary, updated_label, sections, updated_at
       FROM legal_documents WHERE slug = $1`,
    [slug],
  );

export const listLegalSlugs = (): Promise<{ slug: string; title: string }[]> =>
  query<{ slug: string; title: string }>("SELECT slug, title FROM legal_documents ORDER BY slug");

/* ------------------------------------------------------- pages and bundles */

export type PageRow = {
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  hero: Record<string, unknown>;
  sections: unknown[];
  updated_at: number;
};

export type BundleRow = {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  event_type: string;
  badge: string | null;
  image_path: string | null;
  image_alt: string | null;
  sort_order: number;
};

export type BundleItemRow = {
  bundle_slug: string;
  service_slug: string;
  configuration: Record<string, unknown>;
  sort_order: number;
};

export const findPage = (slug: string): Promise<PageRow | null> =>
  queryOne<PageRow>(
    `SELECT slug, title, kicker, summary, hero, sections, updated_at
       FROM content_pages WHERE slug = $1`,
    [slug],
  );

export const listPageSlugs = (): Promise<{ slug: string; title: string; summary: string }[]> =>
  query<{ slug: string; title: string; summary: string }>(
    "SELECT slug, title, summary FROM content_pages ORDER BY slug",
  );

export const listBundles = (): Promise<BundleRow[]> =>
  query<BundleRow>(
    `SELECT slug, name, tagline, blurb, event_type, badge, image_path, image_alt, sort_order
       FROM bundles WHERE is_active ORDER BY sort_order`,
  );

export const findBundle = (slug: string): Promise<BundleRow | null> =>
  queryOne<BundleRow>(
    `SELECT slug, name, tagline, blurb, event_type, badge, image_path, image_alt, sort_order
       FROM bundles WHERE slug = $1 AND is_active`,
    [slug],
  );

export const listBundleItems = (slug: string): Promise<BundleItemRow[]> =>
  query<BundleItemRow>(
    `SELECT bundle_slug, service_slug, configuration, sort_order
       FROM bundle_items WHERE bundle_slug = $1 ORDER BY sort_order`,
    [slug],
  );
