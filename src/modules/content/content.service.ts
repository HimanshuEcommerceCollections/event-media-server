/**
 * Shapes the content rows into the payloads each page renders.
 *
 * The landing page's shape is fixed by frontend/app/content-fallback.js, which
 * holds a static copy of it for when the API is unreachable — the two must
 * agree, so changing a field here means changing that file too.
 */

import { notFound } from "../../lib/http.js";
import * as repo from "./content.repo.js";
import type { ServiceBlockRow, ServiceRow } from "./content.repo.js";

/* ------------------------------------------------------------------ services */

export type ServiceSummary = {
  slug: string;
  no: string;
  title: string;
  blurb: string;
  price: { label: string; cents: number | null; unit: string | null };
  isB2b: boolean;
  image: { path: string; alt: string };
  iconKey: string;
  href: string;
};

const toServiceSummary = (row: ServiceRow): ServiceSummary => ({
  slug: row.slug,
  no: row.no,
  title: row.title,
  blurb: row.blurb,
  price: { label: row.price_label, cents: row.price_cents, unit: row.price_unit },
  isB2b: row.is_b2b,
  image: { path: row.image_path, alt: row.image_alt },
  iconKey: row.icon_key,
  href: `/services/${row.slug}`,
});

/* ---------------------------------------------------------------------- home */

export async function getHomeContent() {
  const [services, events, categories, testimonials, stats] = await Promise.all([
    repo.listServices(),
    repo.listFeaturedEvents(),
    repo.listCategories(),
    repo.listTestimonials("home"),
    repo.listStats("home"),
  ]);

  return {
    services: services.map(toServiceSummary),
    featuredEvents: events.map((e) => ({
      slug: e.slug,
      name: e.name,
      year: e.year,
      totalCents: e.total_cents,
      totalLabel: e.total_label,
      image: { path: e.image_path, alt: e.image_alt },
    })),
    categories: categories.map((c) => ({ key: c.key, label: c.label })),
    testimonials: testimonials.map((t) => ({
      id: t.id,
      quote: t.quote,
      authorName: t.author_name,
      authorRole: t.author_role,
      initials: t.initials,
    })),
    stats: stats.map((s) => ({
      key: s.key,
      value: s.value,
      decimals: s.decimals,
      prefix: s.prefix,
      suffix: s.suffix,
      label: s.label,
    })),
  };
}

/* ------------------------------------------------------------ service detail */

/**
 * A block's payload shape depends on its kind — a rentals item carries a
 * quantity step, a photo pack carries a duration — so blocks are grouped by
 * kind and handed over as-is. The page knows what its own kinds look like.
 */
function groupBlocks(rows: ServiceBlockRow[]): Record<string, Record<string, unknown>[]> {
  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const row of rows) {
    (grouped[row.kind] ??= []).push(row.payload);
  }
  return grouped;
}

/** Kinds that are one object per service, not a list. */
const SINGULAR_KINDS = new Set(["pricing", "hero", "calculator"]);

export async function getServiceDetail(slug: string) {
  const service = await repo.findService(slug);
  if (service === null) throw notFound(`No service called "${slug}".`);

  const [blocks, allServices, gallery] = await Promise.all([
    repo.listServiceBlocks(slug),
    repo.listServices(),
    repo.listGallery(`service:${slug}`),
  ]);

  const grouped = groupBlocks(blocks);
  const singular: Record<string, Record<string, unknown> | null> = {};
  for (const kind of SINGULAR_KINDS) {
    const list = grouped[kind];
    singular[kind] = list?.[0] ?? null;
    delete grouped[kind];
  }

  return {
    ...toServiceSummary(service),
    hero: singular.hero ?? service.hero,
    /** Everything the calculator needs: rates, bounds, packs, add-ons. */
    pricing: singular.pricing ?? null,
    blocks: grouped,
    gallery: gallery.map((g) => ({
      id: g.id,
      image: { path: g.image_path, alt: g.label },
      label: g.label,
      caption: g.caption,
    })),
    /** Every service page paints the same nav and menu, so it ships with one. */
    navigation: buildNavigation(allServices, `/services/${slug}`),
  };
}

export async function listServiceSummaries() {
  const services = await repo.listServices();
  return {
    services: services.map(toServiceSummary),
    navigation: buildNavigation(services, null),
  };
}

/**
 * The service links in the header dropdown and the numbered overlay menu. Both
 * were hardcoded per page, which meant a new service had to be added in seven
 * places; deriving them from the catalogue is the point of serving them here.
 *
 * `currentHref` is the path of the page being rendered, so the caller does not
 * have to know whether "current" means a service slug, the landing page or the
 * reviews page.
 */
function buildNavigation(services: ServiceRow[], currentHref: string | null) {
  const link = (href: string, label: string, idx: string) => ({
    href,
    label,
    idx,
    isCurrent: href === currentHref,
  });

  return {
    services: services.map((s) => ({
      href: `/services/${s.slug}`,
      label: s.title,
      slug: s.slug,
      isCurrent: `/services/${s.slug}` === currentHref,
    })),
    menu: [
      link("/", "Home", "00"),
      ...services.map((s) => link(`/services/${s.slug}`, s.title, s.no)),
      link("/reviews", "Reviews", "→"),
    ],
  };
}

/* ------------------------------------------------------------------- reviews */

export async function getReviewsContent() {
  const [rows, summary, stats, marquee, services] = await Promise.all([
    repo.listReviews(),
    repo.reviewSummary(),
    repo.listStats("reviews"),
    repo.listGallery("reviews:marquee"),
    repo.listServices(),
  ]);

  const total = summary?.total ?? 0;
  // A percentage of nothing is 0, not NaN — the bar widths are rendered
  // straight into a style attribute.
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return {
    summary: {
      total,
      average: total === 0 ? 0 : Math.round((summary?.average ?? 0) * 10) / 10,
      histogram: [
        { stars: 5, count: summary?.five ?? 0, percent: pct(summary?.five ?? 0) },
        { stars: 4, count: summary?.four ?? 0, percent: pct(summary?.four ?? 0) },
        { stars: 3, count: summary?.three ?? 0, percent: pct(summary?.three ?? 0) },
        { stars: 2, count: summary?.two ?? 0, percent: pct(summary?.two ?? 0) },
        { stars: 1, count: summary?.one ?? 0, percent: pct(summary?.one ?? 0) },
      ],
    },
    stats: stats.map((s) => ({
      key: s.key,
      value: s.value,
      decimals: s.decimals,
      prefix: s.prefix,
      suffix: s.suffix,
      label: s.label,
    })),
    // The filter chips are derived from the catalogue plus an "All" chip, so a
    // new service gains a filter without a second edit.
    filters: [
      { key: "all", label: "All" },
      ...services.map((s) => ({ key: s.slug, label: s.title })),
    ],
    spotlight: rows
      .filter((r) => r.is_spotlight)
      .map((r) => ({
        id: r.id,
        image: { path: r.image_path ?? "", alt: r.author_name },
        // The carousel's cut of the quote when there is one; the wall copy
        // otherwise, so a spotlight entry never renders empty.
        quote: r.spotlight_quote ?? r.body,
        stars: r.stars,
        initials: r.initials,
        authorName: r.author_name,
        tag: r.spotlight_tag ?? r.service_label,
      })),
    reviews: rows.map((r) => ({
      id: r.id,
      categoryKey: r.category_key,
      serviceLabel: r.service_label,
      authorName: r.author_name,
      initials: r.initials,
      avatarColor: r.avatar_color,
      stars: r.stars,
      body: r.body,
      whenLabel: r.when_label,
    })),
    marquee: marquee.map((m) => ({ id: m.id, image: { path: m.image_path, alt: m.label }, label: m.label })),
    navigation: buildNavigation(services, "/reviews"),
  };
}

/* --------------------------------------------------------------------- legal */

export async function getLegalDocument(slug: string) {
  const [doc, services] = await Promise.all([repo.findLegalDocument(slug), repo.listServices()]);
  if (doc === null) throw notFound(`No document called "${slug}".`);
  return {
    slug: doc.slug,
    title: doc.title,
    kicker: doc.kicker,
    summary: doc.summary,
    updatedLabel: doc.updated_label,
    updatedAt: doc.updated_at,
    sections: doc.sections,
    // The legal pages paint the same header and footer as every other page,
    // so they get the same link set rather than keeping their own copy.
    navigation: buildNavigation(services, `/legal/${doc.slug}`),
  };
}

export const listLegalDocuments = () => repo.listLegalSlugs();
