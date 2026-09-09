/**
 * Event booking requests — the one consolidated request the builder submits.
 *
 * Two rules hold this together:
 *   - every price is computed here from the catalogue, so `package_total` is
 *     what the services actually cost and not what a browser posted;
 *   - `large_event_flag` is derived here too, so a wedding or a 100+ headcount
 *     raises the coordinator caveat whether or not the page remembered to.
 */

import { query, queryOne, withTransaction } from "../../db/pool.js";
import { badRequest, notFound } from "../../lib/http.js";
import { newId, nowSeconds } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";
import { money, pricePackage } from "../pricing/pricing.engine.js";
import { isLargeEvent } from "../pricing/pricing.service.js";
import type { PricedLine } from "../pricing/pricing.types.js";
import { nextReference } from "./bookings.reference.js";
import type { CreateBookingInput, QuoteInput } from "./bookings.schemas.js";

type BookingRow = {
  id: string;
  request_id: string;
  brand: string;
  event_type: string;
  event_date: string | null;
  headcount_band: string;
  event_zip: string | null;
  large_event_flag: boolean;
  line_items: PricedLine[];
  package_total: number;
  budget_band: string | null;
  contact: { fullName: string; email: string; phone?: string };
  notes: string | null;
  source: string;
  status: string;
  created_at: number;
};

const LARGE_EVENT_CAVEAT =
  "An event this size is quoted by a coordinator — expect us to customise this package.";

/**
 * Prices a package without storing anything. The builder can call this on
 * every tile change and get exactly the figures a submission would record.
 */
export async function quotePackage(input: QuoteInput) {
  const { lineItems, packageTotal } = await pricePackage(input.lineItems);
  const largeEvent =
    input.event?.type !== undefined && input.event.headcountBand !== undefined
      ? isLargeEvent(input.event.type, input.event.headcountBand)
      : false;

  return {
    lineItems: lineItems.map(toLineDto),
    packageTotal,
    packageTotalLabel: money(packageTotal),
    largeEventFlag: largeEvent,
    largeEventNotice: largeEvent ? LARGE_EVENT_CAVEAT : null,
  };
}

export async function createBooking(input: CreateBookingInput, userId: string | null) {
  const { lineItems, packageTotal } = await pricePackage(
    input.lineItems.map((line) => ({
      serviceType: line.serviceType,
      configuration: line.configuration,
      bundleId: line.bundleId ?? input.bundleId,
    })),
  );

  // Six tiles all left at zero is a configured-nothing package; the submit
  // button is meant to be disabled, and this is the server saying the same.
  if (lineItems.length === 0) {
    throw badRequest("Configure at least one service before sending your request.");
  }

  // A total that disagrees means the page priced against a catalogue that has
  // since moved. Quoting the visitor the old number would be the defect.
  if (input.clientTotal !== undefined && input.clientTotal !== packageTotal) {
    throw badRequest(
      "Prices changed while you were building — check the updated total and send again.",
      { shownTotal: input.clientTotal, currentTotal: packageTotal, currentTotalLabel: money(packageTotal) },
    );
  }

  const largeEventFlag = isLargeEvent(input.event.type, input.event.headcountBand);

  const row = await withTransaction(async (tx) => {
    const reference = await nextReference("EVM", tx);
    const rows = await tx.query<BookingRow>(
      `INSERT INTO event_booking_requests
         (id, request_id, brand, user_id, event_type, event_date, headcount_band,
          event_zip, large_event_flag, line_items, package_total, budget_band,
          contact, notes, source, created_at)
       VALUES ($1,$2,'events',$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13,$14,$15)
       RETURNING id, request_id, brand, event_type, event_date, headcount_band,
                 event_zip, large_event_flag, line_items, package_total, budget_band,
                 contact, notes, source, status, created_at`,
      [
        newId("evb"),
        reference,
        userId,
        input.event.type,
        input.event.date ?? null,
        input.event.headcountBand,
        input.event.zip ?? null,
        largeEventFlag,
        JSON.stringify(lineItems),
        packageTotal,
        input.budgetBand ?? null,
        JSON.stringify(input.contact),
        input.notes ?? null,
        input.source,
        nowSeconds(),
      ],
    );
    return rows[0] ?? null;
  });

  if (row === null) throw new Error("createBooking returned no row");

  logger.info("event booking request received", {
    requestId: row.request_id,
    services: lineItems.length,
    packageTotal,
    largeEventFlag,
  });

  return toDto(row);
}

export async function listMyBookings(userId: string) {
  const rows = await query<BookingRow>(`${SELECT_COLUMNS} WHERE user_id = $1
     ORDER BY created_at DESC LIMIT 50`, [userId]);
  return rows.map(toDto);
}

/**
 * Looked up by reference alone — the success page reloads on it, and the
 * builder submits without an account. Nothing sensitive is behind it beyond
 * what the visitor just typed, and the reference is not guessable.
 */
export async function getBookingByReference(reference: string) {
  const row = await queryOne<BookingRow>(`${SELECT_COLUMNS} WHERE request_id = $1`, [
    reference.toUpperCase(),
  ]);
  if (row === null) throw notFound("We cannot find a request with that reference.");
  return toDto(row);
}

const SELECT_COLUMNS = `
  SELECT id, request_id, brand, event_type, event_date, headcount_band, event_zip,
         large_event_flag, line_items, package_total, budget_band, contact, notes,
         source, status, created_at
    FROM event_booking_requests`;

const toLineDto = (item: PricedLine) => ({
  serviceType: item.serviceType,
  label: item.label,
  configuration: item.configuration,
  linePrice: item.lineCents,
  linePriceLabel: money(item.lineCents),
  breakdown: item.breakdown.map((part) => ({ ...part, label: part.label, centsLabel: money(part.cents) })),
  ...(item.bundleId === undefined ? {} : { bundleId: item.bundleId }),
});

function toDto(row: BookingRow) {
  return {
    requestId: row.request_id,
    brand: row.brand,
    createdAt: row.created_at,
    event: {
      type: row.event_type,
      date: row.event_date,
      headcountBand: row.headcount_band,
      zip: row.event_zip,
    },
    lineItems: (row.line_items ?? []).map(toLineDto),
    packageTotal: row.package_total,
    packageTotalLabel: money(row.package_total),
    budgetBand: row.budget_band,
    contact: row.contact,
    notes: row.notes,
    largeEventFlag: row.large_event_flag,
    largeEventNotice: row.large_event_flag ? LARGE_EVENT_CAVEAT : null,
    source: row.source,
    status: row.status,
  };
}
