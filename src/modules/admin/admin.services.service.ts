/**
 * Admin CRUD for `services` + `service_blocks`. Bespoke rather than built on
 * the tableResource factory: `get` also loads the service's blocks, and
 * `update` optionally replaces every block for that service in one
 * transaction when the caller sends `blocks`.
 */

import { query, queryOne, withTransaction } from "../../db/pool.js";
import { notFound } from "../../lib/http.js";
import { newId } from "../../lib/ids.js";

type ServiceRow = {
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
  is_active: boolean;
};

type ServiceBlockRow = {
  id: string;
  kind: string;
  sort_order: number;
  payload: Record<string, unknown>;
};

export type ServiceInput = {
  slug?: string;
  no?: string;
  title?: string;
  blurb?: string;
  priceLabel?: string;
  priceCents?: number | null;
  priceUnit?: string | null;
  isB2b?: boolean;
  imagePath?: string;
  imageAlt?: string;
  iconKey?: string;
  hero?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
};

export type ServiceBlockInput = { kind: string; sortOrder: number; payload: Record<string, unknown> };

const SELECT_COLUMNS = `
  SELECT slug, no, title, blurb, price_label, price_cents, price_unit, is_b2b,
         image_path, image_alt, icon_key, hero, sort_order, is_active
    FROM services`;

function toDto(row: ServiceRow) {
  return {
    slug: row.slug,
    no: row.no,
    title: row.title,
    blurb: row.blurb,
    priceLabel: row.price_label,
    priceCents: row.price_cents,
    priceUnit: row.price_unit,
    isB2b: row.is_b2b,
    imagePath: row.image_path,
    imageAlt: row.image_alt,
    iconKey: row.icon_key,
    hero: row.hero,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function blockToDto(row: ServiceBlockRow) {
  return { id: row.id, kind: row.kind, sortOrder: row.sort_order, payload: row.payload };
}

export async function listServices(page: number, pageSize: number, offset: number) {
  const [rows, countRow] = await Promise.all([
    query<ServiceRow>(`${SELECT_COLUMNS} ORDER BY sort_order LIMIT $1 OFFSET $2`, [pageSize, offset]),
    queryOne<{ count: number }>("SELECT COUNT(*)::bigint AS count FROM services"),
  ]);
  return { items: rows.map(toDto), page, pageSize, total: countRow?.count ?? 0 };
}

export async function getService(slug: string) {
  const [row, blocks] = await Promise.all([
    queryOne<ServiceRow>(`${SELECT_COLUMNS} WHERE slug = $1`, [slug]),
    query<ServiceBlockRow>(
      "SELECT id, kind, sort_order, payload FROM service_blocks WHERE slug = $1 ORDER BY sort_order",
      [slug],
    ),
  ]);
  if (row === null) throw notFound(`No service called "${slug}".`);
  return { ...toDto(row), blocks: blocks.map(blockToDto) };
}

export async function createService(input: ServiceInput) {
  const row = await queryOne<ServiceRow>(
    `INSERT INTO services
       (slug, no, title, blurb, price_label, price_cents, price_unit, is_b2b,
        image_path, image_alt, icon_key, hero, sort_order, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,FALSE),$9,$10,$11,COALESCE($12::jsonb,'{}'::jsonb),$13,COALESCE($14,TRUE))
     RETURNING slug, no, title, blurb, price_label, price_cents, price_unit, is_b2b,
               image_path, image_alt, icon_key, hero, sort_order, is_active`,
    [
      input.slug,
      input.no,
      input.title,
      input.blurb,
      input.priceLabel,
      input.priceCents ?? null,
      input.priceUnit ?? null,
      input.isB2b ?? null,
      input.imagePath,
      input.imageAlt,
      input.iconKey,
      input.hero === undefined ? null : JSON.stringify(input.hero),
      input.sortOrder,
      input.isActive ?? null,
    ],
  );
  if (row === null) throw new Error("insert into services returned no row");
  return { ...toDto(row), blocks: [] as ReturnType<typeof blockToDto>[] };
}

export async function updateService(
  slug: string,
  input: Partial<ServiceInput> & { blocks?: ServiceBlockInput[] },
) {
  const fieldMap: Record<string, { column: string; json?: boolean }> = {
    no: { column: "no" },
    title: { column: "title" },
    blurb: { column: "blurb" },
    priceLabel: { column: "price_label" },
    priceCents: { column: "price_cents" },
    priceUnit: { column: "price_unit" },
    isB2b: { column: "is_b2b" },
    imagePath: { column: "image_path" },
    imageAlt: { column: "image_alt" },
    iconKey: { column: "icon_key" },
    hero: { column: "hero", json: true },
    sortOrder: { column: "sort_order" },
    isActive: { column: "is_active" },
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, { column, json }] of Object.entries(fieldMap)) {
    if (!(key in input)) continue;
    const raw = (input as Record<string, unknown>)[key];
    values.push(json ? JSON.stringify(raw) : raw);
    sets.push(json ? `${column} = $${values.length}::jsonb` : `${column} = $${values.length}`);
  }

  await withTransaction(async (tx) => {
    if (sets.length > 0) {
      values.push(slug);
      const updated = await tx.execute(
        `UPDATE services SET ${sets.join(", ")} WHERE slug = $${values.length}`,
        values,
      );
      if (updated === 0) throw notFound(`No service called "${slug}".`);
    } else {
      const exists = await tx.queryOne("SELECT 1 FROM services WHERE slug = $1", [slug]);
      if (exists === null) throw notFound(`No service called "${slug}".`);
    }

    if (input.blocks !== undefined) {
      await tx.execute("DELETE FROM service_blocks WHERE slug = $1", [slug]);
      for (const block of input.blocks) {
        await tx.execute(
          `INSERT INTO service_blocks (id, slug, kind, sort_order, payload)
           VALUES ($1, $2, $3, $4, $5::jsonb)`,
          [newId("svb"), slug, block.kind, block.sortOrder, JSON.stringify(block.payload)],
        );
      }
    }
  });

  return getService(slug);
}
