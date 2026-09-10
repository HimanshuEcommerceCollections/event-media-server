/**
 * Admin CRUD for `bundles` + `bundle_items`, mirroring admin.services.service.ts:
 * `get` also loads the bundle's items, and `update` optionally replaces every
 * item for that bundle in one transaction when the caller sends `items`.
 */

import { query, queryOne, withTransaction } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { newId } from "../../lib/ids.js";

type BundleRow = {
  slug: string;
  name: string;
  tagline: string;
  blurb: string;
  event_type: string;
  badge: string | null;
  image_path: string | null;
  image_alt: string | null;
  sort_order: number;
  is_active: boolean;
};

type BundleItemRow = {
  id: string;
  service_slug: string;
  configuration: Record<string, unknown>;
  sort_order: number;
};

export type BundleInput = {
  slug?: string;
  name?: string;
  tagline?: string;
  blurb?: string;
  eventType?: string;
  badge?: string | null;
  imagePath?: string | null;
  imageAlt?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

export type BundleItemInput = { serviceSlug: string; configuration: Record<string, unknown>; sortOrder: number };

const SELECT_COLUMNS = `
  SELECT slug, name, tagline, blurb, event_type, badge, image_path, image_alt, sort_order, is_active
    FROM bundles`;

function toDto(row: BundleRow) {
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    blurb: row.blurb,
    eventType: row.event_type,
    badge: row.badge,
    imagePath: row.image_path,
    imageAlt: row.image_alt,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function itemToDto(row: BundleItemRow) {
  return { id: row.id, serviceSlug: row.service_slug, configuration: row.configuration, sortOrder: row.sort_order };
}

export async function listBundles(page: number, pageSize: number, offset: number) {
  const [rows, countRow] = await Promise.all([
    query<BundleRow>(`${SELECT_COLUMNS} ORDER BY sort_order LIMIT $1 OFFSET $2`, [pageSize, offset]),
    queryOne<{ count: number }>("SELECT COUNT(*)::bigint AS count FROM bundles"),
  ]);
  return { items: rows.map(toDto), page, pageSize, total: countRow?.count ?? 0 };
}

export async function getBundle(slug: string) {
  const [row, items] = await Promise.all([
    queryOne<BundleRow>(`${SELECT_COLUMNS} WHERE slug = $1`, [slug]),
    query<BundleItemRow>(
      "SELECT id, service_slug, configuration, sort_order FROM bundle_items WHERE bundle_slug = $1 ORDER BY sort_order",
      [slug],
    ),
  ]);
  if (row === null) throw notFound(`No package called "${slug}".`);
  return { ...toDto(row), items: items.map(itemToDto) };
}

export async function createBundle(input: BundleInput) {
  const row = await queryOne<BundleRow>(
    `INSERT INTO bundles (slug, name, tagline, blurb, event_type, badge, image_path, image_alt, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,TRUE))
     RETURNING slug, name, tagline, blurb, event_type, badge, image_path, image_alt, sort_order, is_active`,
    [
      input.slug,
      input.name,
      input.tagline,
      input.blurb,
      input.eventType,
      input.badge ?? null,
      input.imagePath ?? null,
      input.imageAlt ?? null,
      input.sortOrder,
      input.isActive ?? null,
    ],
  );
  if (row === null) throw new Error("insert into bundles returned no row");
  return { ...toDto(row), items: [] as ReturnType<typeof itemToDto>[] };
}

export async function updateBundle(
  slug: string,
  input: Partial<BundleInput> & { items?: BundleItemInput[] },
) {
  const fieldMap: Record<string, string> = {
    name: "name",
    tagline: "tagline",
    blurb: "blurb",
    eventType: "event_type",
    badge: "badge",
    imagePath: "image_path",
    imageAlt: "image_alt",
    sortOrder: "sort_order",
    isActive: "is_active",
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(fieldMap)) {
    if (!(key in input)) continue;
    values.push((input as Record<string, unknown>)[key]);
    sets.push(`${column} = $${values.length}`);
  }

  await withTransaction(async (tx) => {
    if (sets.length > 0) {
      values.push(slug);
      const updated = await tx.execute(`UPDATE bundles SET ${sets.join(", ")} WHERE slug = $${values.length}`, values);
      if (updated === 0) throw notFound(`No package called "${slug}".`);
    } else {
      const exists = await tx.queryOne("SELECT 1 FROM bundles WHERE slug = $1", [slug]);
      if (exists === null) throw notFound(`No package called "${slug}".`);
    }

    if (input.items !== undefined) {
      await tx.execute("DELETE FROM bundle_items WHERE bundle_slug = $1", [slug]);
      for (const item of input.items) {
        await tx.execute(
          `INSERT INTO bundle_items (id, bundle_slug, service_slug, configuration, sort_order)
           VALUES ($1, $2, $3, $4::jsonb, $5)`,
          [newId("bni"), slug, item.serviceSlug, JSON.stringify(item.configuration), item.sortOrder],
        );
      }
    }
  });

  return getBundle(slug);
}
