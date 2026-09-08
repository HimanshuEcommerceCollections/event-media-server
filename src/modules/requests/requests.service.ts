/**
 * Quote requests.
 *
 * The total is recomputed here from the line items rather than taken from the
 * client: the page shows a running total, but a number posted from a browser
 * decides nothing about what an event costs.
 */

import { randomInt } from "node:crypto";
import { query, queryOne } from "../../db/pool.js";
import { badRequest } from "../../lib/http.js";
import { newId, nowSeconds } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import type { CreateRequestInput } from "./requests.routes.js";

type QuoteRow = {
  id: string;
  reference: string;
  full_name: string;
  email: string;
  phone: string | null;
  event_date: string | null;
  service_slug: string | null;
  line_items: LineItem[];
  total_cents: number;
  notes: string | null;
  status: string;
  created_at: number;
};

type LineItem = { key: string; label: string; quantity: number; unitCents: number };

/** Human-quotable, e.g. EM-8F3K2Q — read out over the phone without ambiguity. */
function newReference(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[randomInt(0, alphabet.length)];
  return `EM-${out}`;
}

const totalOf = (items: LineItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0);

export async function createQuoteRequest(input: CreateRequestInput, userId: string | null) {
  const items: LineItem[] = input.lineItems.filter((item) => item.quantity > 0);
  if (items.length === 0 && (input.notes === undefined || input.notes === "")) {
    // An enquiry with neither a line item nor a note gives a coordinator
    // nothing to answer.
    throw badRequest("Add at least one item or tell us what you need.");
  }

  const totalCents = totalOf(items);

  // A reference collision is a 1-in-32^6 event, but it is a unique column, so
  // a couple of retries is cheaper than a failed submission.
  let row: QuoteRow | null = null;
  for (let attempt = 0; attempt < 3 && row === null; attempt++) {
    try {
      row = await queryOne<QuoteRow>(
        `INSERT INTO quote_requests
           (id, reference, user_id, full_name, email, phone, event_date,
            service_slug, line_items, total_cents, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
         RETURNING id, reference, full_name, email, phone, event_date, service_slug,
                   line_items, total_cents, notes, status, created_at`,
        [
          newId("req"),
          newReference(),
          userId,
          input.fullName,
          input.email,
          input.phone ?? null,
          input.eventDate ?? null,
          input.serviceSlug ?? null,
          JSON.stringify(items),
          totalCents,
          input.notes ?? null,
          nowSeconds(),
        ],
      );
    } catch (err) {
      const isUnique = typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
      if (!isUnique || attempt === 2) throw err;
    }
  }
  if (row === null) throw new Error("createQuoteRequest returned no row");

  logger.info("quote request received", {
    reference: row.reference,
    service: row.service_slug,
    totalCents: row.total_cents,
  });

  return toDto(row);
}

export async function listMyQuoteRequests(userId: string) {
  const rows = await query<QuoteRow>(
    `SELECT id, reference, full_name, email, phone, event_date, service_slug,
            line_items, total_cents, notes, status, created_at
       FROM quote_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
  return rows.map(toDto);
}

const money = (cents: number): string =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function toDto(row: QuoteRow) {
  return {
    id: row.id,
    reference: row.reference,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    eventDate: row.event_date,
    serviceSlug: row.service_slug,
    lineItems: row.line_items.map((item) => ({
      ...item,
      lineCents: item.quantity * item.unitCents,
      lineLabel: money(item.quantity * item.unitCents),
    })),
    totalCents: row.total_cents,
    totalLabel: money(row.total_cents),
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}
