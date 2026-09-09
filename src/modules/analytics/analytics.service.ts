/**
 * Writes the builder funnel events.
 *
 * A failed write is swallowed: losing a count is not worth failing the request
 * that carried it, and the caller is a fire-and-forget beacon that has nothing
 * to do with an error anyway.
 */

import { query } from "../../db/pool.js";
import { newId, nowSeconds } from "../../lib/ids.js";
import { logger } from "../../lib/logger.js";

type IncomingEvent = { name: string; sessionKey?: string; payload: Record<string, unknown> };

export async function recordEvents(events: IncomingEvent[], userId: string | null): Promise<void> {
  const now = nowSeconds();

  // One multi-row INSERT: a builder session sends these in small batches and a
  // round trip per tile change is the wrong cost for a counter.
  const values: unknown[] = [];
  const tuples = events.map((event, i) => {
    const at = i * 6;
    values.push(
      newId("evt"),
      event.name,
      event.sessionKey ?? null,
      userId,
      JSON.stringify(event.payload),
      now,
    );
    return `($${at + 1}, $${at + 2}, $${at + 3}, $${at + 4}, $${at + 5}::jsonb, $${at + 6})`;
  });

  try {
    await query(
      `INSERT INTO analytics_events (id, name, session_key, user_id, payload, created_at)
       VALUES ${tuples.join(", ")}`,
      values,
    );
  } catch (err) {
    logger.warn("analytics write failed", {
      error: err instanceof Error ? err.message : String(err),
      events: events.length,
    });
  }
}
