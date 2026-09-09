/**
 * Seeds the content tables.
 *
 * Every write is an upsert keyed on the natural key, so running it repeatedly
 * converges rather than duplicating — which is what lets it be safe to call on
 * every boot and by hand after editing the seed data.
 *
 * Account tables are never touched. Only catalogue and copy live here.
 *
 * `seedIfEmpty` is what index.ts calls: it does nothing once services exist, so
 * an edit made in the database is not silently reverted on the next restart.
 * `npm run seed` calls `seedContent` directly to force a refresh.
 */

import { pathToFileURL } from "node:url";
import { closeDatabase, queryOne, waitForDatabase, withTransaction, type Tx } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { logger } from "../lib/logger.js";
import { nowSeconds } from "../lib/ids.js";
import { SERVICES } from "./seed-data/services.js";
import { CATEGORIES, FEATURED_EVENTS, HOME_STATS, REVIEW_STATS, TESTIMONIALS } from "./seed-data/home.js";
import { REVIEWS, REVIEW_MARQUEE } from "./seed-data/reviews.js";
import { LEGAL_DOCUMENTS } from "./seed-data/legal.js";
import { PAGES } from "./seed-data/pages.js";
import { BUNDLES } from "./seed-data/bundles.js";
import { invalidateCatalogue } from "../modules/pricing/pricing.catalogue.js";

export async function seedContent(): Promise<void> {
  await withTransaction(async (tx) => {
    await seedServices(tx);
    await seedHome(tx);
    await seedReviews(tx);
    await seedLegal(tx);
    await seedPages(tx);
    await seedBundles(tx);
  });
  // The engine caches the catalogue, and the seed has just rewritten the rows
  // it caches. Without this the next booking would price against the old ones.
  invalidateCatalogue();
  logger.info("content seeded", {
    services: SERVICES.length,
    reviews: REVIEWS.length,
    documents: LEGAL_DOCUMENTS.length,
    pages: PAGES.length,
    bundles: BUNDLES.length,
  });
}

export async function seedIfEmpty(): Promise<void> {
  const row = await queryOne<{ count: number }>("SELECT COUNT(*)::bigint AS count FROM services");
  if ((row?.count ?? 0) > 0) {
    logger.debug("content already present, skipping seed");
    return;
  }
  await seedContent();
}

/* ------------------------------------------------------------------ services */

async function seedServices(tx: Tx): Promise<void> {
  for (const [index, service] of SERVICES.entries()) {
    await tx.execute(
      `INSERT INTO services
         (slug, no, title, blurb, price_label, price_cents, price_unit, is_b2b,
          image_path, image_alt, icon_key, hero, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
       ON CONFLICT (slug) DO UPDATE SET
         no = EXCLUDED.no, title = EXCLUDED.title, blurb = EXCLUDED.blurb,
         price_label = EXCLUDED.price_label, price_cents = EXCLUDED.price_cents,
         price_unit = EXCLUDED.price_unit, is_b2b = EXCLUDED.is_b2b,
         image_path = EXCLUDED.image_path, image_alt = EXCLUDED.image_alt,
         icon_key = EXCLUDED.icon_key, hero = EXCLUDED.hero,
         sort_order = EXCLUDED.sort_order, is_active = TRUE`,
      [
        service.slug,
        service.no,
        service.title,
        service.blurb,
        service.priceLabel,
        service.priceCents,
        service.priceUnit,
        service.isB2b,
        service.imagePath,
        service.imageAlt,
        service.iconKey,
        JSON.stringify(service.hero),
        index,
      ],
    );

    // Blocks have no natural key of their own — they are a positional list per
    // kind — so the set is replaced rather than upserted. A removed FAQ would
    // otherwise linger.
    await tx.execute("DELETE FROM service_blocks WHERE slug = $1", [service.slug]);

    // sort_order is per kind, so each list keeps its authored order.
    const nextOrder = new Map<string, number>();
    for (const block of service.blocks) {
      const order = nextOrder.get(block.kind) ?? 0;
      nextOrder.set(block.kind, order + 1);
      await tx.execute(
        `INSERT INTO service_blocks (id, slug, kind, sort_order, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [`blk_${service.slug}_${block.kind}_${order}`, service.slug, block.kind, order, JSON.stringify(block.payload)],
      );
    }

    await tx.execute("DELETE FROM gallery_items WHERE surface = $1", [`service:${service.slug}`]);
    for (const [i, item] of service.gallery.entries()) {
      await tx.execute(
        `INSERT INTO gallery_items (id, surface, image_path, label, caption, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `gal_${service.slug}_${i}`,
          `service:${service.slug}`,
          item.imagePath,
          item.label,
          item.caption ?? null,
          i,
        ],
      );
    }
  }
}

/* ---------------------------------------------------------------------- home */

async function seedHome(tx: Tx): Promise<void> {
  for (const [i, event] of FEATURED_EVENTS.entries()) {
    await tx.execute(
      `INSERT INTO featured_events
         (slug, name, year, total_cents, total_label, image_path, image_alt, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, year = EXCLUDED.year, total_cents = EXCLUDED.total_cents,
         total_label = EXCLUDED.total_label, image_path = EXCLUDED.image_path,
         image_alt = EXCLUDED.image_alt, sort_order = EXCLUDED.sort_order`,
      [
        event.slug,
        event.name,
        event.year,
        event.totalCents,
        event.totalLabel,
        event.imagePath,
        event.imageAlt,
        i,
      ],
    );
  }

  for (const [i, category] of CATEGORIES.entries()) {
    await tx.execute(
      `INSERT INTO categories (key, label, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order`,
      [category.key, category.label, i],
    );
  }

  for (const [i, testimonial] of TESTIMONIALS.entries()) {
    await tx.execute(
      `INSERT INTO testimonials (id, quote, author_name, author_role, initials, surface, sort_order)
       VALUES ($1,$2,$3,$4,$5,'home',$6)
       ON CONFLICT (id) DO UPDATE SET
         quote = EXCLUDED.quote, author_name = EXCLUDED.author_name,
         author_role = EXCLUDED.author_role, initials = EXCLUDED.initials,
         sort_order = EXCLUDED.sort_order`,
      [
        testimonial.id,
        testimonial.quote,
        testimonial.authorName,
        testimonial.authorRole,
        testimonial.initials,
        i,
      ],
    );
  }

  await seedStats(tx, HOME_STATS, "home");
  await seedStats(tx, REVIEW_STATS, "reviews");
}

type SeedStat = {
  key: string;
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
};

async function seedStats(tx: Tx, stats: readonly SeedStat[], surface: string): Promise<void> {
  for (const [i, stat] of stats.entries()) {
    await tx.execute(
      `INSERT INTO stats (key, value, decimals, prefix, suffix, label, surface, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value, decimals = EXCLUDED.decimals, prefix = EXCLUDED.prefix,
         suffix = EXCLUDED.suffix, label = EXCLUDED.label, surface = EXCLUDED.surface,
         sort_order = EXCLUDED.sort_order`,
      [stat.key, stat.value, stat.decimals, stat.prefix, stat.suffix, stat.label, surface, i],
    );
  }
}

/* ------------------------------------------------------------------- reviews */

async function seedReviews(tx: Tx): Promise<void> {
  for (const [i, review] of REVIEWS.entries()) {
    await tx.execute(
      `INSERT INTO reviews
         (id, category_key, service_label, author_name, initials, avatar_color, stars,
          body, when_label, is_spotlight, spotlight_quote, spotlight_tag, image_path, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (id) DO UPDATE SET
         category_key = EXCLUDED.category_key, service_label = EXCLUDED.service_label,
         author_name = EXCLUDED.author_name, initials = EXCLUDED.initials,
         avatar_color = EXCLUDED.avatar_color, stars = EXCLUDED.stars,
         body = EXCLUDED.body, when_label = EXCLUDED.when_label,
         is_spotlight = EXCLUDED.is_spotlight, spotlight_quote = EXCLUDED.spotlight_quote,
         spotlight_tag = EXCLUDED.spotlight_tag, image_path = EXCLUDED.image_path,
         sort_order = EXCLUDED.sort_order`,
      [
        review.id,
        review.categoryKey,
        review.serviceLabel,
        review.authorName,
        review.initials,
        review.avatarColor,
        review.stars,
        review.body,
        review.whenLabel,
        review.isSpotlight ?? false,
        review.spotlightQuote ?? null,
        review.spotlightTag ?? null,
        review.imagePath ?? null,
        i,
      ],
    );
  }

  await tx.execute("DELETE FROM gallery_items WHERE surface = $1", ["reviews:marquee"]);
  for (const [i, item] of REVIEW_MARQUEE.entries()) {
    await tx.execute(
      `INSERT INTO gallery_items (id, surface, image_path, label, sort_order)
       VALUES ($1, 'reviews:marquee', $2, $3, $4)`,
      [`gal_reviews_${i}`, item.imagePath, item.label, i],
    );
  }
}

/* --------------------------------------------------------------------- legal */

async function seedLegal(tx: Tx): Promise<void> {
  for (const doc of LEGAL_DOCUMENTS) {
    await tx.execute(
      `INSERT INTO legal_documents
         (slug, title, kicker, summary, updated_label, sections, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, kicker = EXCLUDED.kicker, summary = EXCLUDED.summary,
         updated_label = EXCLUDED.updated_label, sections = EXCLUDED.sections,
         updated_at = EXCLUDED.updated_at`,
      [
        doc.slug,
        doc.title,
        doc.kicker,
        doc.summary,
        doc.updatedLabel,
        JSON.stringify(doc.sections),
        nowSeconds(),
      ],
    );
  }
}

/* --------------------------------------------------------- pages + bundles */

async function seedPages(tx: Tx): Promise<void> {
  for (const page of PAGES) {
    await tx.execute(
      `INSERT INTO content_pages (slug, title, kicker, summary, hero, sections, updated_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title, kicker = EXCLUDED.kicker, summary = EXCLUDED.summary,
         hero = EXCLUDED.hero, sections = EXCLUDED.sections,
         updated_at = EXCLUDED.updated_at`,
      [
        page.slug,
        page.title,
        page.kicker,
        page.summary,
        JSON.stringify(page.hero),
        JSON.stringify(page.sections),
        nowSeconds(),
      ],
    );
  }
}

async function seedBundles(tx: Tx): Promise<void> {
  for (const [index, bundle] of BUNDLES.entries()) {
    await tx.execute(
      `INSERT INTO bundles
         (slug, name, tagline, blurb, event_type, badge, image_path, image_alt, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, tagline = EXCLUDED.tagline, blurb = EXCLUDED.blurb,
         event_type = EXCLUDED.event_type, badge = EXCLUDED.badge,
         image_path = EXCLUDED.image_path, image_alt = EXCLUDED.image_alt,
         sort_order = EXCLUDED.sort_order, is_active = TRUE`,
      [
        bundle.slug,
        bundle.name,
        bundle.tagline,
        bundle.blurb,
        bundle.eventType,
        bundle.badge,
        bundle.imagePath,
        bundle.imageAlt,
        index,
      ],
    );

    // Items have no natural key beyond their place in the bundle, so the set
    // is replaced rather than upserted row by row — which is also what drops
    // a line removed from the seed.
    await tx.execute("DELETE FROM bundle_items WHERE bundle_slug = $1", [bundle.slug]);
    for (const [itemIndex, item] of bundle.items.entries()) {
      await tx.execute(
        `INSERT INTO bundle_items (id, bundle_slug, service_slug, configuration, sort_order)
         VALUES ($1,$2,$3,$4::jsonb,$5)`,
        [
          `bit_${bundle.slug}_${item.serviceSlug}`,
          bundle.slug,
          item.serviceSlug,
          JSON.stringify(item.configuration),
          itemIndex,
        ],
      );
    }
  }
}

/* ------------------------------------------------------------- CLI entry ---- */

// `npm run seed` runs this file directly and forces a refresh, unlike the
// boot-time seedIfEmpty. index.ts imports this module, so the guard has to
// distinguish "imported" from "is the entry point" — comparing the resolved
// file URL to argv[1] is what does that on both Windows and POSIX paths.
const entry = process.argv[1];
const isDirectRun = entry !== undefined && import.meta.url === pathToFileURL(entry).href;

if (isDirectRun) {
  try {
    await waitForDatabase();
    await runMigrations();
    await seedContent();
  } catch (err) {
    logger.error("seed failed", { error: err instanceof Error ? err.message : String(err) });
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}
